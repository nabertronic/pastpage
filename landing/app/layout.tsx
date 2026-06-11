import type { Metadata } from "next";
import { Fraunces, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "PastPage — When a page is gone, rewind it.",
  description:
    "PastPage is a browser extension that searches the Wayback Machine and 10+ web archives in parallel when a page 404s — and finds the version that still exists. No tracking.",
  icons: { icon: "/logo-mark.svg" },
  openGraph: {
    title: "PastPage — When a page is gone, rewind it.",
    description:
      "Recover missing, changed, and broken pages from 10+ web archives in one click.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
