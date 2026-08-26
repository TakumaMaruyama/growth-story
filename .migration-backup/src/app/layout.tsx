import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "私の競泳物語",
    template: "%s | 私の競泳物語",
  },
  description: "練習日誌、大会目標、競泳物語を、自分の言葉で記録するアプリ",
  applicationName: "私の競泳物語",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "私の競泳物語",
    statusBarStyle: "default",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d4ed8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main-content">本文へ移動</a>
        {children}
      </body>
    </html>
  );
}
