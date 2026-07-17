import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PhoneFrame } from "@/components/layout/PhoneFrame";
import { BottomNav } from "@/components/layout/BottomNav";
import { NO_FLASH_THEME_SCRIPT } from "@/lib/useTheme";

export const metadata: Metadata = {
  title: "Powerfly — your home's energy agent",
  description:
    "A fitness tracker for your house's electricity. An autonomous agent shifts your usage to cheaper, greener times and earns you bill credits.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#14171c" },
  ],
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Set day/night before paint to avoid a theme flash. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <PhoneFrame>{children}</PhoneFrame>
        <BottomNav />
      </body>
    </html>
  );
}
