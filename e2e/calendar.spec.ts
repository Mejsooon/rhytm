import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { missingEnv } from "./e2e-env";

test.skip(missingEnv.length > 0, `Brak zmiennych środowiskowych dla e2e: ${missingEnv.join(", ")}`);

async function signIn(page: Page) {
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
}

// Poniedziałek następnego tygodnia (zawsze po dzisiejszym dniu), żeby wystąpienia były w widoku po jednym kliknięciu „Następny tydzień” (domyślny widok tygodnia na desktopie).
function nextMondayIso() {
  const monday = new Date();
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

test("blok z zadaniami: każde wystąpienie ma własną listę, stan przeżywa przeładowanie", async ({ page }) => {
  const mondayIso = nextMondayIso();
  // Unikalna nazwa, żeby bloki z wcześniejszych przebiegów nie myliły selektorów.
  const title = `Nauka matma ${Date.now()}`;

  await signIn(page);

  // Nowy blok: „Nauka matma”, dni robocze, od poniedziałku następnego tygodnia 09:00–10:00.
  await page.getByRole("button", { name: "Dodaj blok" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nazwa").fill(title);
  await form.getByLabel("Data", { exact: true }).fill(mondayIso);
  await form.getByLabel("Od", { exact: true }).fill("09:00");
  await form.getByLabel("Do", { exact: true }).fill("10:00");
  await form.getByText("Dni robocze").click();
  await form.getByRole("button", { name: "Utwórz blok" }).click();
  await expect(form).toBeHidden();

  const occurrences = page.locator(".rh-ev", { hasText: title });
  const openNextWeek = async () => {
    await page.getByRole("button", { name: "Następny tydzień" }).click();
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
  await page.getByRole("alertdialog").getByText("Wszystkie").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Usuń" }).click();
});

test("kategoria: nowa kategoria w menu, blok w niej, ukrywanie i pokazywanie kropką", async ({ page }) => {
  const categoryName = "Projekty e2e";
  const title = `Blok kategorii ${Date.now()}`;

  await signIn(page);

  // Kategorii nie da się usunąć w tym etapie, więc przy ponownym przebiegu używamy już istniejącej.
  // Tylko pozycja w menu bocznym (grupa „Kategorie”); zakładka o tej samej nazwie jest w grupie „Filtr kategorii”.
  const menuItem = page.getByRole("group", { name: "Kategorie", exact: true }).getByRole("button", { name: new RegExp(`^${categoryName}\\b`) });
  if ((await menuItem.count()) === 0) {
    await page.getByRole("button", { name: "Dodaj kategorię" }).click();
    const categoryDialog = page.getByRole("dialog");
    await categoryDialog.getByLabel("Nazwa").fill(categoryName);
    await categoryDialog.getByRole("radio", { name: "Fioletowy" }).click();
    await categoryDialog.getByRole("button", { name: "Dodaj kategorię" }).click();
    await expect(categoryDialog).toBeHidden();
  }
  await expect(menuItem).toBeVisible();
  // Poprzedni nieudany przebieg mógł zostawić kategorię ukrytą: najpierw ją pokazujemy.
  if ((await menuItem.getAttribute("aria-pressed")) === "false") await menuItem.click();
  await expect(menuItem).toHaveAttribute("aria-pressed", "true");

  // Blok w tej kategorii: poniedziałek następnego tygodnia 11:00–12:00.
  await page.getByRole("button", { name: "Dodaj blok" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nazwa").fill(title);
  await form.getByLabel("Data", { exact: true }).fill(nextMondayIso());
  await form.getByLabel("Od", { exact: true }).fill("11:00");
  await form.getByLabel("Do", { exact: true }).fill("12:00");
  await form.getByRole("radio", { name: categoryName }).click();
  await form.getByRole("button", { name: "Utwórz blok" }).click();
  await expect(form).toBeHidden();

  const occurrence = page.locator(".rh-ev", { hasText: title });
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expect(occurrence).toBeVisible();
  await expect(occurrence).toHaveClass(/rh-ev-violet/);

  // Kropka kategorii w menu ukrywa blok, ponowne kliknięcie go pokazuje.
  await menuItem.click();
  await expect(menuItem).toHaveAttribute("aria-pressed", "false");
  await expect(occurrence).toHaveCount(0);
  await menuItem.click();
  await expect(menuItem).toHaveAttribute("aria-pressed", "true");
  await expect(occurrence).toBeVisible();

  // Panel bloku: kategoria w nagłówku, zamykany klawiszem Esc, kalendarz pod spodem zostaje.
  await occurrence.click();
  const panel = page.getByRole("dialog");
  await expect(panel).toContainText(categoryName);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Sprzątanie: usuwamy blok testowy.
  await occurrence.click();
  await page.getByRole("button", { name: "Usuń blok" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Usuń" }).click();
  await expect(occurrence).toHaveCount(0);
});
