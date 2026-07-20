import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { bodyFontClassName, fontVariables } from "@/app/fonts";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale, locales } from "@/i18n/config";
import { siteUrl } from "@/lib/site";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../globals.css";

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
  const ogLocale = locale === "fr" ? "fr_FR" : "en_US";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: dict.site.title,
      template: `%s · ${dict.site.wordmark}`,
    },
    description: dict.site.description,
    applicationName: dict.site.wordmark,
    openGraph: {
      type: "website",
      siteName: dict.site.wordmark,
      locale: ogLocale,
      title: dict.site.title,
      description: dict.site.description,
      url: `/${locale}`,
    },
    twitter: {
      card: "summary_large_image",
      title: dict.site.title,
      description: dict.site.description,
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: "/fr",
        en: "/en",
        "x-default": "/fr",
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#171615" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${fontVariables} ${bodyFontClassName} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <ConvexClientProvider>
              {children}
            </ConvexClientProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
