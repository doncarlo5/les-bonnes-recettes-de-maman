import type { Dictionary } from "@/i18n/get-dictionary";

type SiteFooterProps = {
  dict: Dictionary;
};

export function SiteFooter({ dict }: SiteFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-pale-blue-200/60 bg-pale-blue-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-12 text-center lg:px-10">
        <p className="font-heading text-2xl italic text-stone-700">
          {dict.footer.tagline}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-400">
          © {year} · {dict.site.wordmark} · {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
