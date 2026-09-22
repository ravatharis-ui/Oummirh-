import { expect, test } from "@playwright/test";

/**
 * Guards and login screens.
 *
 * These run without a configured Supabase project: with no valid session, the
 * guards must send a visitor to the login screen. That is precisely what is worth
 * proving here — a private space must never render for someone signed out, even
 * when the backend is unreachable.
 */
test.describe("espaces protégés", () => {
  test("l'espace collaboratrice renvoie vers la connexion", async ({ page }) => {
    await page.goto("/accueil");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("le profil renvoie vers la connexion", async ({ page }) => {
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("l'espace direction renvoie vers sa connexion", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  test("la liste des collaboratrices renvoie vers la connexion direction", async ({ page }) => {
    await page.goto("/admin/collaboratrices");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  // Le pointage et le planning tiennent les heures et les selfies de tout le
  // monde : ils doivent être les premiers à fermer la porte à une visiteuse
  // sans session, y compris quand la base est injoignable.
  test("l'écran de pointage renvoie vers la connexion", async ({ page }) => {
    await page.goto("/pointer");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("le planning de la collaboratrice renvoie vers la connexion", async ({ page }) => {
    await page.goto("/planning");
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("le planning de la direction renvoie vers sa connexion", async ({ page }) => {
    await page.goto("/admin/planning");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  test("la présence du jour renvoie vers sa connexion", async ({ page }) => {
    await page.goto("/admin/pointage");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  test("l'historique des pointages renvoie vers sa connexion", async ({ page }) => {
    await page.goto("/admin/pointage/historique");
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });
});

test.describe("écran de connexion collaboratrice", () => {
  test("demande d'abord le point de vente", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { name: "Où travaillez-vous ?" })).toBeVisible();
    await expect(page.getByRole("link", { name: /je suis la direction/i })).toBeVisible();
  });
});

test.describe("écran de connexion direction", () => {
  test("propose email et mot de passe", async ({ page }) => {
    await page.goto("/admin/connexion");
    await expect(page.getByLabel("Adresse email")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("refuse des identifiants vides sans quitter la page", async ({ page }) => {
    await page.goto("/admin/connexion");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });
});
