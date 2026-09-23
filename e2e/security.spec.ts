import { expect, test } from "@playwright/test";

/**
 * La politique de sécurité du contenu.
 *
 * C'est la seule pièce de l'application qui peut casser **toutes** les pages à
 * la fois : une directive trop stricte, et le framework lui-même est bloqué —
 * écran blanc, sans message, sans personne pour le réparer depuis un
 * navigateur.
 *
 * Ces tests ne vérifient pas que la politique est bonne : ils vérifient qu'elle
 * ne bloque rien de ce que l'application a besoin de charger, ce qu'une
 * relecture ne peut pas dire.
 */
const PUBLIC_PAGES = ["/", "/connexion", "/admin/connexion", "/confidentialite"];

test.describe("politique de sécurité du contenu", () => {
  test("l'en-tête est posé sur chaque page", async ({ page }) => {
    for (const path of PUBLIC_PAGES) {
      const response = await page.goto(path);
      const csp = response?.headers()["content-security-policy"];

      expect(csp, `CSP absente sur ${path}`).toBeTruthy();
      expect(csp).toContain("nonce-");
      expect(csp).toContain("frame-ancestors 'none'");
    }
  });

  test("le nonce change à chaque visite", async ({ page }) => {
    // Un nonce réutilisé ne protège de rien : il suffirait de le lire une fois.
    const first = (await page.goto("/"))?.headers()["content-security-policy"];
    const second = (await page.goto("/connexion"))?.headers()["content-security-policy"];

    expect(first).not.toBe(second);
  });

  test("aucune page publique ne déclenche de violation", async ({ page }) => {
    const violations: string[] = [];

    page.on("console", (message) => {
      const text = message.text();
      if (/content security policy|refused to (load|execute|apply)/i.test(text)) {
        violations.push(text);
      }
    });

    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      // Les scripts du framework se chargent après le HTML : sans cette
      // attente, le test passerait avant que la politique ait eu à bloquer.
      await page.waitForLoadState("networkidle");
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("l'application reste interactive sous la politique", async ({ page }) => {
    // Si la CSP bloquait les scripts de Next, la page s'afficherait mais rien
    // ne répondrait. Une navigation côté client le prouve mieux qu'un rendu.
    await page.goto("/");
    await page.getByRole("link", { name: /espace direction/i }).click();
    await expect(page).toHaveURL(/\/admin\/connexion$/);
    await expect(page.getByLabel("Adresse email")).toBeVisible();
  });
});

test.describe("en-têtes de sécurité", () => {
  test("les protections de base sont en place", async ({ page }) => {
    const headers = (await page.goto("/"))?.headers() ?? {};

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    // La caméra sert au pointage ; le micro et la position, jamais.
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["permissions-policy"]).toContain("geolocation=()");
  });

  test("l'application n'est pas référençable", async ({ page }) => {
    // Une application RH interne n'a rien à faire dans un moteur de recherche.
    await page.goto("/");
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/);
  });
});

test.describe("installation sur le téléphone", () => {
  test("le manifeste décrit une application installable", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBe("Oummi RH");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");

    // Android rogne les bords d'une icône : sans « maskable », le rond blanc se
    // ferait couper sur une partie des téléphones.
    const purposes = manifest.icons.map((icon: { purpose?: string }) => icon.purpose);
    expect(purposes).toContain("maskable");
  });

  test("les icônes existent vraiment", async ({ request }) => {
    for (const icon of [
      "/icon-192.png",
      "/icon-512.png",
      "/icon-maskable-512.png",
      "/apple-icon.png",
    ]) {
      const response = await request.get(icon);
      expect(response.ok(), `${icon} introuvable`).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });
});
