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
}

// Usuwa wpis snu z dzisiejszej nocy (jeśli jest), żeby test startował i kończył z pustym formularzem.
async function deleteTodaySleepIfAny(page: Page) {
  await page.goto("/nawyki");
  const sleepForm = page.getByRole("form", { name: "Wpis snu" });
  await expect(sleepForm.getByRole("button", { name: "Zapisz" })).toBeVisible();
  const remove = sleepForm.getByRole("button", { name: "Usuń" });
  if ((await remove.count()) === 0) return;
  await remove.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Usuń" }).click();
  await expect(remove).toHaveCount(0);
}

test("nawyki, sen i ekran Dziś: utworzenie, odhaczenie, zapis snu, archiwizacja", async ({ page }) => {
  // Unikalna nazwa, żeby nawyki z wcześniejszych przebiegów nie myliły selektorów.
  const name = `Woda e2e ${Date.now()}`;

  await signIn(page);
  await deleteTodaySleepIfAny(page);

  try {
    // 1. Nowy nawyk „codziennie” na /nawyki.
    await page.getByRole("button", { name: "Nowy nawyk" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nazwa").fill(name);
    await dialog.getByRole("radio", { name: "Codziennie" }).click();
    await dialog.getByRole("button", { name: "Utwórz nawyk" }).click();
    await expect(dialog).toBeHidden();

    const habitsList = page.getByRole("region", { name: "Dzisiejsze nawyki" });
    await expect(habitsList.getByRole("checkbox", { name, exact: true })).not.toBeChecked();

    // Stan licznika „X z Y zaplanowanych” przed odhaczeniem (na koncie z innymi nawykami nie jest to „0 z 1”).
    const scoreText = habitsList.getByText(/\d+ z \d+ zaplanowanych/);
    const before = (await scoreText.textContent())!.match(/(\d+) z (\d+) zaplanowanych/)!;
    const doneBefore = Number(before[1]);
    const total = Number(before[2]);

    // 2. Nawyk jest widoczny na /dzis; odhaczamy go tam i czekamy na zapis akcji serwera.
    await page.goto("/dzis");
    const todayHabits = page.getByRole("region", { name: "Nawyki na dziś" });
    const todayCheckbox = todayHabits.getByRole("checkbox", { name });
    await expect(todayCheckbox).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/dzis")),
      todayCheckbox.click(),
    ]);
    await expect(todayCheckbox).toBeChecked();

    // 3. Na /nawyki nawyk jest odhaczony, a licznik wzrósł o jeden.
    await page.goto("/nawyki");
    await expect(habitsList.getByRole("checkbox", { name, exact: true })).toBeChecked();
    await expect(habitsList.getByText(`${doneBefore + 1} z ${total} zaplanowanych`)).toBeVisible();

    // 4. Sen 23:40 – 07:10, samopoczucie 4: „7 h 30” w formularzu (liczone na żywo i po zapisie).
    const sleepForm = page.getByRole("form", { name: "Wpis snu" });
    await sleepForm.getByLabel("Zasnąłem").fill("23:40");
    await sleepForm.getByLabel("Obudziłem się").fill("07:10");
    await expect(sleepForm.getByText("7 h 30")).toBeVisible();
    await sleepForm.getByRole("radiogroup", { name: "Samopoczucie" }).getByRole("radio", { name: "4", exact: true }).click();
    await sleepForm.getByRole("button", { name: "Zapisz" }).click();
    // „Usuń” pojawia się dopiero po zapisie wpisu.
    await expect(sleepForm.getByRole("button", { name: "Usuń" })).toBeVisible();

    // Po przeładowaniu formularz dalej pokazuje zapisany wpis.
    await page.reload();
    await expect(sleepForm.getByText("7 h 30")).toBeVisible();
    await expect(sleepForm.getByLabel("Zasnąłem")).toHaveValue("23:40");

    // 5. Na /dzis: kafelek podsumowania i karta „Sen” pokazują ten sam wpis.
    await page.goto("/dzis");
    await expect(page.getByRole("region", { name: "Podsumowanie dnia" }).getByText("7 h 30")).toBeVisible();
    const lastNight = page.getByRole("region", { name: "Ostatnia noc" });
    await expect(lastNight.getByText("7 h 30")).toBeVisible();
    await expect(lastNight.getByText("23:40 – 07:10 · samopoczucie 4/5")).toBeVisible();

    // 6. Archiwizacja z szuflady szczegółów: nawyk znika z listy (też po przeładowaniu i z /dzis).
    await page.goto("/nawyki");
    await habitsList.getByRole("button", { name, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archiwizuj" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Archiwizuj" }).click();
    await expect(habitsList.getByRole("checkbox", { name, exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Nowy nawyk" }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name, exact: true })).toHaveCount(0);
    await page.goto("/dzis");
    await expect(page.getByRole("region", { name: "Nawyki na dziś" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name })).toHaveCount(0);
  } finally {
    // Sprzątanie także po nieudanym przebiegu: wpis snu usuwamy zawsze, nawyk archiwizujemy, jeśli został.
    await deleteTodaySleepIfAny(page);
    const leftover = page.getByRole("button", { name, exact: true });
    if ((await leftover.count()) > 0) {
      await leftover.click();
      await page.getByRole("dialog").getByRole("button", { name: "Archiwizuj" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Archiwizuj" }).click();
      await expect(leftover).toHaveCount(0);
    }
  }
});
