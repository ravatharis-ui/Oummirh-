import { expect, test } from "@playwright/test";

test("la page d'accueil propose les deux espaces", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Oummi RH" })).toBeVisible();
  await expect(page.getByRole("link", { name: /espace collaboratrice/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /espace direction/i })).toBeVisible();
});
