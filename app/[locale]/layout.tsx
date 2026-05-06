import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Geist_Mono, Nunito_Sans, Playfair_Display } from "next/font/google";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale, locales } from "@/i18n/config";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "../globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type RootLayoutProps = {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

type MetadataProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: MetadataProps): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(locale)) {
    notFound();
  }

  const dict = await getDictionary(locale);

  return {
    title: dict.site.title,
    description: dict.site.description,
  };
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(locale)) {
    notFound();
  }

  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${nunitoSans.variable} ${playfairDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ConvexClientProvider>
          <SiteHeader locale={locale} dict={dict} />
          <div className="flex-1">{children}</div>
          <SiteFooter dict={dict} />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
