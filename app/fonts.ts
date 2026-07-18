import { Geist_Mono, Newsreader, Source_Sans_3 } from "next/font/google";

export const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

export const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const fontVariables = `${sourceSans.variable} ${newsreader.variable} ${geistMono.variable}`;
export const bodyFontClassName = sourceSans.className;
