import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supernova Video Studio - All-in-One AI Video Studio",
  description: "Wan 2.2 + Mochi 1 + SVD + OpenShorts in one platform. Text to Video, Image to Video, Long to Shorts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}