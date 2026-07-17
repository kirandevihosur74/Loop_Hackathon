import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { BottomNav } from "@/components/layout/BottomNav";

export const metadata: Metadata = {
  title: "Loop — your home's energy agent",
  description:
    "A fitness tracker for your house's electricity. An autonomous agent shifts your usage to cheaper, greener times and earns you bill credits.",
};

export const viewport: Viewport = {
  themeColor: "#eef2ef",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <PhoneFrame>{children}</PhoneFrame>
        <BottomNav />
      </body>
    </html>
  );
}
