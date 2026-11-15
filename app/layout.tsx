import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import "./globals.css";

// Atkinson Hyperlegible was designed for low-vision readers: the right default for elders.
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display-face" });

export const metadata: Metadata = {
  title: "Dor · someone always holds the string",
  description:
    "A care circle for an elder's medicines and appointments. Every missed dose gets one owner, prescriptions from different doctors are checked against each other, and the elder stays in charge.",
};

export const viewport: Viewport = { themeColor: "#fbf6ee" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
