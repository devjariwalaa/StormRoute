import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "StormRoute — Weather-aware road trips",
  description:
    "Forecast the drive, compare departure times, and understand modeled weather risk along your route.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
