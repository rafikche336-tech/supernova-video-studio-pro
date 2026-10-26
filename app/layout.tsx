import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Supernova Video Studio",
  description: "Wan 2.2 + Mochi 1 + SVD + OpenShorts",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
