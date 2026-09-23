import type { Metadata } from "next";
import Link from "next/link";

import { getSettings } from "@/core/settings";
import { Button } from "@/core/ui/button";

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Ce que l'application Oummi RH enregistre, pourquoi, combien de temps, et comment exercer ses droits.",
};

export const dynamic = "force-dynamic";

/**
 * La page de confidentialité.
 *
 * Volontairement hors de tout espace protégé : une collaboratrice doit pouvoir
 * la lire **avant** de se connecter, c'est-à-dire avant d'accepter quoi que ce
 * soit. Le lien figure sur l'écran de connexion et dans son profil.
 *
 * Elle est écrite pour être lue, pas pour couvrir. Les durées affichées sont
 * celles réellement appliquées, lues dans les réglages : si la direction change
 * la rétention des photos, cette page change avec.
 */
export default async function PrivacyPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold">Confidentialité</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Ce que {settings.company_name} enregistre dans cette application, pourquoi, et pendant
          combien de temps.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Ce qui est enregistré</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          <li>
            <strong>Ton identité professionnelle</strong> : nom, prénom, point de vente, type de
            contrat, date d&apos;embauche. Téléphone et adresse email si tu en donnes un.
          </li>
          <li>
            <strong>Tes pointages</strong> : l&apos;heure d&apos;arrivée, de pause et de départ,
            enregistrées par le serveur.
          </li>
          <li>
            <strong>Une photo au moment de pointer ton arrivée</strong>, si la direction l&apos;a
            demandée dans les réglages.
          </li>
          <li>
            <strong>Ton planning, tes congés, ton solde d&apos;heures</strong> et les demandes que
            tu déposes.
          </li>
          <li>
            <strong>Tes documents</strong> : fiches de paie, contrat, attestations, déposés par la
            direction.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">La photo au pointage</h2>
        <div className="bg-secondary/50 flex flex-col gap-2 rounded-xl p-4 text-base">
          <p>
            <strong>Ce n&apos;est pas de la biométrie.</strong> Aucun visage n&apos;est mesuré,
            comparé ni reconnu. L&apos;image n&apos;est jamais analysée par un programme : elle sert
            uniquement à ce qu&apos;une personne puisse, en cas de doute, vérifier qui a pointé.
          </p>
          <p>
            Elle est prise par la caméra frontale, réduite et compressée dans ton téléphone avant
            d&apos;être envoyée. Elle est rangée dans un espace privé où seule toi — et la direction
            — peut la voir, par un lien valable soixante secondes.
          </p>
          <p>
            Elle est{" "}
            <strong>
              supprimée automatiquement au bout de {settings.selfie_retention_days} jours
            </strong>
            . Ton pointage, lui, est conservé : c&apos;est l&apos;heure qui compte, pas
            l&apos;image.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Qui voit quoi</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          <li>
            <strong>Tes collègues</strong> ne voient que qui travaille avec elles aujourd&apos;hui.
            Jamais tes congés, jamais un arrêt maladie, jamais une raison d&apos;absence.
          </li>
          <li>
            <strong>La direction</strong> voit les plannings, les pointages, les soldes et les
            documents de toute l&apos;équipe : c&apos;est ce qui lui permet d&apos;organiser le
            travail et d&apos;établir la paie.
          </li>
          <li>
            <strong>Personne d&apos;autre.</strong> L&apos;application n&apos;est pas référencée
            dans les moteurs de recherche, et chaque accès est vérifié par la base de données
            elle-même, pas seulement par l&apos;écran.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Combien de temps</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          <li>
            <strong>Photos de pointage</strong> : {settings.selfie_retention_days} jours, puis
            suppression automatique chaque nuit.
          </li>
          <li>
            <strong>Pointages, plannings, congés, heures</strong> : conservés pendant toute la
            relation de travail et la durée légale qui la suit — ce sont des pièces justificatives.
          </li>
          <li>
            <strong>Documents</strong> : conservés tant que tu en as besoin. Tu peux demander une
            copie à tout moment.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Tes droits</h2>
        <p className="text-base">
          Tu peux demander à consulter, corriger ou effacer les informations qui te concernent, et
          t&apos;opposer à un traitement. Une erreur de pointage se corrige : préviens la direction,
          qui ajoute une correction motivée — l&apos;enregistrement d&apos;origine reste, et la
          correction est tracée.
        </p>
        <p className="text-base">
          Pour toute demande, adresse-toi à la direction de {settings.company_name}. Tu peux aussi
          saisir la CNIL si tu estimes que tes droits ne sont pas respectés.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Ce que l&apos;application ne fait pas</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          <li>Elle ne te géolocalise pas.</li>
          <li>
            Elle n&apos;accède pas à ta galerie photo : seule la caméra, au moment où tu pointes.
          </li>
          <li>Elle ne lit pas tes contacts, tes messages, ni quoi que ce soit d&apos;autre.</li>
          <li>Elle ne partage rien avec des tiers à des fins commerciales.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    </main>
  );
}
