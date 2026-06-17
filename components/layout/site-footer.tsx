import type { Dictionary } from "@/i18n/get-dictionary";

type SiteFooterProps = {
  dict: Dictionary;
};

export function SiteFooter({ dict }: SiteFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-12 text-center lg:px-10">
        <p className="font-heading text-2xl italic text-foreground">
          {dict.footer.tagline}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          © {year} · {dict.site.wordmark} · {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
