import { permanentRedirect } from "next/navigation";
import type { Locale } from "@/i18n/config";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const [{ locale }, values] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();

  for (const key of ["q", "cat", "view", "sort", "order"] as const) {
    const value = values[key];
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  }

  permanentRedirect(`/${locale}${query.size > 0 ? `?${query}` : ""}#recettes`);
}
