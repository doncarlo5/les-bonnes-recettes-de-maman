import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import Link from "next/link";

type SiteFooterProps = {
  dict: Dictionary;
  locale: Locale;
};

export function SiteFooter({ dict, locale }: SiteFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-12 text-center lg:px-10">
        <p className="type-byline text-foreground">
          {dict.footer.tagline}
        </p>
        <p className="type-label text-muted-foreground">
          © {year} · {dict.site.wordmark} · {dict.footer.rights}
        </p>
        <nav aria-label={dict.footer.contact} className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link className="underline-offset-4 hover:underline" href={`/${locale}/conditions-de-participation`}>
            {dict.footer.contributionTerms}
          </Link>
          <Link className="underline-offset-4 hover:underline" href={`/${locale}/confidentialite-et-retrait`}>
            {dict.footer.privacy}
          </Link>
          <a className="underline-offset-4 hover:underline" href="mailto:pro.julien.thomas@gmail.com">
            pro.julien.thomas@gmail.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
