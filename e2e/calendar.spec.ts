import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { missingEnv } from "./e2e-env";

test.skip(missingEnv.length > 0, `Brak zmiennych środowiskowych dla e2e: ${missingEnv.join(", ")}`);

test("blok z zadaniami: każde wystąpienie ma własną listę, stan przeżywa przeładowanie", async ({ page }) => {
  // Poniedziałek następnego tygodnia (zawsze po dzisiejszym dniu), żeby wystąpienia były w widoku po jednym kliknięciu „Następny okres”.
  const monday = new Date();
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  const mondayIso = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  // Unikalna nazwa, żeby bloki z wcześniejszych przebiegów nie myliły selektorów.
  const title = `Nauka matma ${Date.now()}`;

  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_EMAIL!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  });
  await page.goto("/kalendarz");

  // Nowy blok: „Nauka matma”, dni robocze, od poniedziałku następnego tygodnia 09:00–10:00.
  await page.getByRole("button", { name: "Nowy blok" }).first().click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nazwa").fill(title);
  await form.getByLabel("Data").fill(mondayIso);
  await form.getByLabel("Początek").fill("09:00");
  await form.getByLabel("Koniec").fill("10:00");
  await form.getByText("Dni robocze").click();
  await form.getByRole("button", { name: "Utwórz blok" }).click();
  await expect(form).toBeHidden();

  const occurrences = page.locator(".rh-ev", { hasText: title });
  const openNextWeek = async () => {
    await page.getByRole("button", { name: "Następny okres" }).click();
    await expect(occurrences.first()).toBeVisible();
  };
  await openNextWeek();

  // Poniedziałek: dodajemy „A” i „B”, odhaczamy „A”.
  await occurrences.nth(0).click();
  const panel = page.getByRole("dialog");
  await panel.getByLabel("Dodaj zadanie").fill("A");
  await panel.getByLabel("Dodaj zadanie").press("Enter");
  await expect(panel.getByRole("checkbox", { name: "A" })).toBeVisible();
  await panel.getByLabel("Dodaj zadanie").fill("B");
  await panel.getByLabel("Dodaj zadanie").press("Enter");
  await expect(panel.getByRole("checkbox", { name: "B" })).toBeVisible();
  await panel.getByRole("checkbox", { name: "A" }).click();
  await expect(panel.getByTestId("task-counter")).toHaveText("1/2");
  await panel.getByRole("button", { name: "Zamknij panel" }).click();
  await expect(occurrences.nth(0)).toContainText("1/2");

  // Wtorek: własna, pusta lista.
  await occurrences.nth(1).click();
  await expect(page.getByRole("dialog").getByTestId("task-counter")).toHaveText("0/0");
  await expect(page.getByRole("dialog").getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Zamknij panel" }).click();

  // Po przeładowaniu poniedziałek dalej pokazuje „1/2”.
  await page.reload();
  await openNextWeek();
  await expect(occurrences.nth(0)).toContainText("1/2");

  // Sprzątanie: usuwamy całą serię testowego bloku.
  await occurrences.nth(0).click();
  await page.getByRole("button", { name: "Usuń blok" }).click();
  await page.getByRole("dialog").getByText("Cała seria").click();
  await page.getByRole("dialog").getByRole("button", { name: "Usuń" }).click();
});
