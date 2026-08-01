import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "私の競泳物語",
    template: "%s | 私の競泳物語",
  },
  description: "練習日誌、大会目標、競泳物語を、自分の言葉で記録するアプリ",
  robots: { index: false, follow: false },
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
