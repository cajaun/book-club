import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book Club",
  description: "A clean starting point for the Book Club project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
