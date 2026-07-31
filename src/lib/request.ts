import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_MAX_BODY_BYTES = 128 * 1024;
const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
} as const;

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

export type JsonObjectResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse };

export function validateRequestOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');

  // Reverse proxies can expose a public HTTPS origin while Next.js sees an
  // internal HTTP URL. Modern browsers send Sec-Fetch-Site as a forbidden
  // header, so application JavaScript cannot forge `same-origin`. Keep the
  // explicit Origin comparison as the fallback for clients that omit it.
  const originMismatch = Boolean(origin && origin !== request.nextUrl.origin);
  if (fetchSite === 'cross-site' || (originMismatch && fetchSite !== 'same-origin')) {
    return jsonResponse({ error: 'リクエスト元を確認できません' }, 403);
  }

  return null;
}

async function readBodyWithLimit(
  request: NextRequest,
  maxBodyBytes: number,
): Promise<{ ok: true; value: string } | { ok: false; tooLarge: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, value: '' };

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteLength = 0;
  let value = '';

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > maxBodyBytes) {
        await reader.cancel('request body limit exceeded').catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      value += decoder.decode(chunk.value, { stream: true });
    }
    value += decoder.decode();
    return { ok: true, value };
  } catch {
    return { ok: false, tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}

export async function readJsonObject(
  request: NextRequest,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<JsonObjectResult> {
  const originError = validateRequestOrigin(request);
  if (originError) return { ok: false, response: originError };

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return { ok: false, response: jsonResponse({ error: 'Content-Type は application/json を指定してください' }, 415) };
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return { ok: false, response: jsonResponse({ error: 'リクエストが大きすぎます' }, 413) };
  }

  const body = await readBodyWithLimit(request, maxBodyBytes);
  if (!body.ok) {
    const error = body.tooLarge ? 'リクエストが大きすぎます' : 'リクエストを読み取れませんでした';
    return { ok: false, response: jsonResponse({ error }, body.tooLarge ? 413 : 400) };
  }
  const rawBody = body.value;

  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, response: jsonResponse({ error: 'JSONオブジェクトを指定してください' }, 400) };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: jsonResponse({ error: 'JSONの形式が正しくありません' }, 400) };
  }
}
