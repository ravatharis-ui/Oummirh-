import type { MetadataRoute } from "next";

/**
 * Le manifeste qui rend l'application installable.
 *
 * Une collaboratrice l'ajoute à son écran d'accueil et pointe depuis une icône,
 * sans passer par le navigateur ni retenir une adresse. C'est tout ce qu'on
 * demande à la PWA ici : pas de mode hors ligne, parce que pointer hors réseau
 * reviendrait à accepter une heure venue du téléphone.
 *
 * `start_url` pointe sur la racine et non sur `/accueil` : la page d'accueil
 * publique oriente vers le bon espace selon la session, et une collaboratrice
 * déconnectée doit arriver sur la connexion, pas sur une redirection.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oummi RH",
    short_name: "Oummi RH",
    description: "Pointage, planning, congés et documents pour l'équipe d'Oummi Dressing.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f5",
    theme_color: "#b14f42",
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
