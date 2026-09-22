import { expect, test } from "@playwright/test";

/**
 * Phase 1 acceptance: a module added to the registry shows up in both menus and on
 * both dashboards, without any menu or layout file mentioning it.
 *
 * These run without a configured Supabase project: settings fall back to their
 * documented defaults, so the registry is exercised on its own.
 */
test.describe("espace collaboratrice", () => {
  test("le menu du bas est construit par le registre", async ({ page }) => {
    await page.goto("/accueil");

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Accueil" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Démo" })).toBeVisible();

    // The widget comes from the module manifest, not from the home page.
    await expect(page.getByText("Module de démonstration")).toBeVisible();
  });

  test("l'onglet du module mène à son écran", async ({ page }) => {
    await page.goto("/accueil");
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Démo" })
      .click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole("heading", { name: "Module de démonstration" })).toBeVisible();
  });
});

test.describe("espace direction", () => {
  test("la barre latérale est construite par le registre", async ({ page }) => {
    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link", { name: "Tableau de bord" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Démo" })).toBeVisible();

    await expect(page.getByText("Modules actifs : Démo.")).toBeVisible();
  });

  test("l'entrée du module mène à son écran", async ({ page }) => {
    await page.goto("/admin");
    await page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link", { name: "Démo" })
      .click();
    await expect(page).toHaveURL(/\/admin\/demo$/);
    await expect(page.getByRole("heading", { name: "Module de démonstration" })).toBeVisible();
  });
});
