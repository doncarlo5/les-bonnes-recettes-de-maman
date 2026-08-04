import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/get-dictionary";
import { hasLocale, type Locale } from "@/i18n/config";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return { title: dict.legal.termsTitle, description: dict.legal.termsDescription };
}

export default async function ContributionTermsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const isFrench = locale === "fr";
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 lg:py-24">
      <Link className="type-label text-primary" href={`/${locale}/recettes`}>{dict.legal.back}</Link>
      <h1 className="type-page-title mt-6">{dict.legal.termsTitle}</h1>
      <p className="type-editorial-lead mt-5 text-muted-foreground">{dict.legal.termsDescription}</p>
      <div className="mt-10 grid gap-6 type-body-spacious">
        <p>{isFrench ? "Vous devez être propriétaire de la photo publiée, ou disposer de l’autorisation nécessaire pour la partager." : "You must own the photo you publish or have the permission needed to share it."}</p>
        <p>{isFrench ? "Si une personne est identifiable sur l’image, vous devez avoir obtenu son consentement. Pour un mineur, l’accord de son représentant légal est nécessaire." : "If anyone is identifiable in the image, you must have their consent. For a minor, consent from their legal guardian is required."}</p>
        <p>{isFrench ? "La photo doit montrer une réalisation de la recette concernée. Les contenus illicites, trompeurs, haineux, sexuellement explicites, publicitaires ou portant atteinte aux droits d’autrui peuvent être retirés." : "The photo must show a make of the relevant recipe. Illegal, deceptive, hateful, sexually explicit, promotional, or rights-infringing content may be removed."}</p>
        <p>{isFrench ? "Vous accordez au carnet une autorisation non exclusive d’afficher et d’adapter techniquement la photo pour le service. Vous pouvez supprimer votre contribution depuis le navigateur d’origine ou demander son retrait." : "You grant the cookbook a non-exclusive permission to display and technically adapt the photo for the service. You can delete your contribution from the original browser or request removal."}</p>
        <p>{isFrench ? "Pour toute question ou demande :" : "For questions or requests:"} <a className="underline" href="mailto:pro.julien.thomas@gmail.com">pro.julien.thomas@gmail.com</a>.</p>
      </div>
    </main>
  );
}
