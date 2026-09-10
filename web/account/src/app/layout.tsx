import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Munder Difflin · Account",
  description: "Manage your Munder Difflin Pro licence and downloads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon-32.png" sizes="32x32" />
      </head>
      <body>{children}</body>
    </html>
  );
}
