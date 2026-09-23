/**
 * La politique de sécurité du contenu.
 *
 * Elle est construite ici, en dehors du proxy, pour une raison simple :
 * c'est la seule pièce de l'application qui peut casser **toutes** les pages à
 * la fois, et une fonction pure se teste sans navigateur.
 *
 * Deux choix méritent d'être expliqués.
 *
 * `script-src` utilise un nonce et `'strict-dynamic'`, comme Next le prévoit :
 * le framework pose lui-même le nonce sur ses scripts, et rien d'autre ne peut
 * s'exécuter. C'est la partie qui protège réellement d'une injection.
 *
 * `style-src` garde `'unsafe-inline'` **sans** nonce, et c'est délibéré. Avec un
 * nonce, les navigateurs ignorent `'unsafe-inline'` — y compris pour les
 * attributs `style=""`, que React et plusieurs composants posent en permanence.
 * Une feuille de style injectée ne permet pas d'exécuter du code ; échanger une
 * protection marginale contre un risque d'écran blanc serait un mauvais marché.
 */
export interface CspOptions {
  nonce: string;
  /** L'origine Supabase du projet, pour `connect-src` et le temps réel. */
  supabaseUrl?: string | undefined;
  /** En développement, React a besoin de `eval` pour ses messages d'erreur. */
  isDevelopment?: boolean;
}

function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return [];

  try {
    const { origin, host, protocol } = new URL(supabaseUrl);
    if (!protocol.startsWith("http")) return [];

    // Le temps réel passe par une WebSocket : sans `wss:`, la cloche de
    // notifications et le tableau de présence cessent de se mettre à jour.
    return [origin, `wss://${host}`];
  } catch {
    return [];
  }
}

export function buildCsp({ nonce, supabaseUrl, isDevelopment = false }: CspOptions): string {
  const supabase = supabaseOrigins(supabaseUrl);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // `blob:` est indispensable : le selfie est fabriqué dans un canvas avant
    // d'être envoyé, et il n'a pas d'autre origine que la mémoire du navigateur.
    "img-src": ["'self'", "blob:", "data:", ...supabase],
    "media-src": ["'self'", "blob:", ...supabase],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...supabase],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([directive, values]) => `${directive} ${values.join(" ")}`,
  );

  // En développement le serveur est en clair : forcer HTTPS y casserait tout.
  if (!isDevelopment) parts.push("upgrade-insecure-requests");

  return parts.join("; ");
}

/**
 * Le nom de l'en-tête à poser.
 *
 * `Content-Security-Policy-Report-Only` observe sans bloquer. C'est la sortie
 * de secours du propriétaire : une variable d'environnement dans Vercel, un
 * redéploiement, et l'application refonctionne pendant qu'on regarde ce qui
 * coince. Sans cela, une politique trop stricte serait un site mort sans
 * personne pour le réparer depuis un navigateur.
 */
export function cspHeaderName(reportOnly: boolean): string {
  return reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}
