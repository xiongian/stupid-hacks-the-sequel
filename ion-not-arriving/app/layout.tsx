import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ion know",
  description: "The only transit planner that tells you when the Ion won't be there",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
