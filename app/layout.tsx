import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StaffingNation — Mockup",
  description: "Internal dev mockup",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
