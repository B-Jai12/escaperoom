import React from "react"
import type { Metadata } from "next"
import { Orbitron, Share_Tech_Mono, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const _orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const _shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  weight: "400",
});

const _jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Escape Room",
  description: "An immersive escape room experience",
};

const fontVars = [
  _orbitron.variable,
  _shareTechMono.variable,
  _jetbrainsMono.variable,
].join(" ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${fontVars}`}>{children}</body>
    </html>
  );
}
