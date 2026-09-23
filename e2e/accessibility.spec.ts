import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibilité, mesurée plutôt qu'affirmée.
 *
 * Le critère de la Phase 11 parle de Lighthouse ≥ 90. Lighthouse donne une note
 * qui mélange beaucoup de choses ; axe donne des **manquements nommés**, qu'on
 * peut corriger un par un. C'est ce qui sert ici : l'équipe d'Oummi travaille
 * debout, sur des téléphones, parfois en plein soleil.
 *
 * Seules les pages publiques sont testées : les autres exigent une session, et
 * un test qui ne peut pas s'exécuter ne prouve rien.
 */
const PAGES = [
  ["/", "l'accueil"],
  ["/connexion", "la connexion collaboratrice"],
  ["/admin/connexion", "la connexion direction"],
  ["/confidentialite", "la page de confidentialité"],
] as const;

for (const [path, name] of PAGES) {
  test(`${name} ne présente aucun manquement WCAG A ou AA`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const summary = results.violations
      .map((violation) => `${violation.id} — ${violation.help} (${violation.nodes.length})`)
      .join("\n");

    expect(results.violations, summary).toEqual([]);
  });
}

test("chaque page publique annonce sa langue", async ({ page }) => {
  // Sans cela, un lecteur d'écran lit le français avec une prononciation
  // anglaise — techniquement accessible, concrètement incompréhensible.
  for (const [path] of PAGES) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  }
});

test("les cibles tactiles de la connexion tiennent le pouce", async ({ page }) => {
  // 48 px est le minimum de la charte : en dessous, on tape à côté, et on tape
  // à côté debout dans une boutique bien plus souvent qu'assis à un bureau.
  await page.goto("/connexion");

  const links = page.getByRole("link");
  const count = await links.count();

  for (let index = 0; index < count; index += 1) {
    const box = await links.nth(index).boundingBox();
    if (!box) continue;
    expect(box.height, `lien ${index} trop petit`).toBeGreaterThanOrEqual(40);
  }
});
