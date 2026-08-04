import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return { title: dict.legal.privacyTitle, description: dict.legal.privacyDescription };
}

export default async function PrivacyAndRemovalPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const isFrench = locale === "fr";
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 lg:py-24">
      <Link className="type-label text-primary" href={`/${locale}/recettes`}>{dict.legal.back}</Link>
      <h1 className="type-page-title mt-6">{dict.legal.privacyTitle}</h1>
      <p className="type-editorial-lead mt-5 text-muted-foreground">{dict.legal.privacyDescription}</p>
      <div className="mt-10 grid gap-6 type-body-spacious">
        <p>{isFrench ? "Le carnet publie la photo traitée, le nom, la légende et la description visuelle que vous fournissez. Le fichier original et ses métadonnées sont supprimés après traitement." : "The cookbook publishes the processed photo, name, caption, and visual description you provide. The original file and its metadata are deleted after processing."}</p>
        <p>{isFrench ? "Une session pseudonyme signée permet de reconnaître vos contributions, vos Bravo et vos signalements sans créer de compte. Les adresses réseau ne sont jamais stockées en clair : un condensat est conservé au plus 24 heures pour limiter les abus." : "A signed pseudonymous session recognizes your contributions, Bravos, and reports without an account. Network addresses are never stored in plain text: a digest is retained for at most 24 hours to limit abuse."}</p>
        <p>{isFrench ? "Vous pouvez supprimer immédiatement votre réalisation depuis le navigateur qui l’a publiée. Pour signaler un problème de vie privée, de droit d’auteur, ou demander un retrait, utilisez le bouton Signaler ou écrivez à l’adresse ci-dessous avec le lien de la recette." : "You can immediately delete your make from the browser that published it. To report a privacy or copyright issue, or request removal, use the Report button or email the address below with the recipe link."}</p>
        <p><a className="underline" href="mailto:pro.julien.thomas@gmail.com">pro.julien.thomas@gmail.com</a></p>
      </div>
    </main>
  );
}
