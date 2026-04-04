import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "위고업잉글리시",
  description: "영어학원 학습관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      </head>
      <body>{children}</body>
    </html>
  );
}
