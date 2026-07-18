import { Geist_Mono, Nunito_Sans, Playfair_Display } from "next/font/google";

export const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  display: "swap",
});

export const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const fontVariables = `${nunitoSans.variable} ${playfairDisplay.variable} ${geistMono.variable}`;
