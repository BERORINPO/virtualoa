import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Girlfriend - バーチャル彼女",
  description: "リアルタイム音声会話が可能なバーチャル彼女AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
