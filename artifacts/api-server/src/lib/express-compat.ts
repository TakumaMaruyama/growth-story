import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, CookieOptions } from "express";

export interface ApiResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

export interface NextRequest {
  headers: Headers;
  nextUrl: URL;
  body: unknown;
  log: { error: (...args: unknown[]) => void };
}

const context = new AsyncLocalStorage<{ req: Request; res: Response }>();

export function runWithRequestContext<T>(
  req: Request,
  res: Response,
  callback: () => Promise<T>,
): Promise<T> {
  return context.run({ req, res }, callback);
}

export function requestFromExpress(req: Request): NextRequest {
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost";
  return {
    headers: new Headers(
      Object.entries(req.headers).flatMap(([key, value]) =>
        value === undefined
          ? []
          : [[key, Array.isArray(value) ? value.join(",") : value] as [string, string]],
      ),
    ),
    nextUrl: new URL(req.originalUrl || req.url, `${protocol}://${host}`),
    body: req.body,
    log: req.log,
  };
}

export function cookies() {
  const active = context.getStore();
  if (!active) throw new Error("Request cookie context is unavailable");
  return {
    get(name: string) {
      const value = active.req.cookies?.[name];
      return value === undefined ? undefined : { value: String(value) };
    },
    set(name: string, value: string, options: Record<string, unknown>) {
      // Next's cookie API accepts maxAge in seconds; Express accepts milliseconds.
      const maxAge = typeof options.maxAge === "number" ? options.maxAge * 1000 : undefined;
      active.res.cookie(name, value, { ...options, maxAge } as CookieOptions);
    },
    delete(name: string) {
      active.res.clearCookie(name, { path: "/" });
    },
  };
}

/** Only used by server-rendering helpers retained for parity. */
export function redirect(location: string): never {
  const error = new Error(`Redirect: ${location}`);
  error.name = "RedirectError";
  throw error;
}