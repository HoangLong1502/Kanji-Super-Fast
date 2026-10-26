import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Sans_JP } from "next/font/google";
import { Nav } from "../components/Nav";
import { getSessionUser } from "../lib/authService";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans"
});

const jp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jp"
});

export const metadata: Metadata = {
  title: "SuperKanji",
  description: "Học kanji từ PowerPoint và PDF: Hán Việt, flashcard và đọc hiragana."
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="vi">
      <body className={`${sans.variable} ${jp.variable} font-sans text-ink antialiased`}>
        <Nav userName={user?.name} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
