import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexAura AI Teaching Assistant Demo",
  description: "Per-school AI teaching assistant demo for NexAura.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
