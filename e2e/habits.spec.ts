import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";
import { missingEnv } from "./e2e-env";

// UWAGA: test na chwilę ZASTĘPUJE wpis snu z dzisiejszej nocy konta testowego (czyta go, usuwa, zapisuje własny),
// a na końcu przywraca oryginał (godziny, samopoczucie, notatka). Awaria procesu w trakcie może zostawić wpis testowy
// (23:40-07:10), dlatego używaj osobnego konta testowego, nie swojego głównego.
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

type SleepSnapshot = { sleptAt: string; wokeAt: string; feeling: string | null; note: string };

// Czyta wpis snu z dzisiejszej nocy z formularza na /nawyki (null, gdy wpisu nie ma).
async function readTodaySleep(page: Page): Promise<SleepSnapshot | null> {
  await page.goto("/nawyki");
  const sleepForm = page.getByRole("form", { name: "Wpis snu" });
  await expect(sleepForm.getByRole("button", { name: "Zapisz" })).toBeVisible();
  if ((await sleepForm.getByRole("button", { name: "Usuń" }).count()) === 0) return null;
  const checked = sleepForm.getByRole("radio", { checked: true });
  return {
    sleptAt: await sleepForm.getByLabel("Zasnąłem").inputValue(),
    wokeAt: await sleepForm.getByLabel("Obudziłem się").inputValue(),
    feeling: (await checked.count()) > 0 ? await checked.first().innerText() : null,
    note: await sleepForm.getByLabel("Notatka").inputValue(),
  };
}

// Usuwa wpis snu z dzisiejszej nocy (jeśli jest) i zostawia pusty formularz.
async function deleteTodaySleepIfAny(page: Page) {
  await page.goto("/nawyki");
  const sleepForm = page.getByRole("form", { name: "Wpis snu" });
  await expect(sleepForm.getByRole("button", { name: "Zapisz" })).toBeVisible();
  const remove = sleepForm.getByRole("button", { name: "Usuń" });
  if ((await remove.count()) === 0) return;
  const confirm = page.getByRole("alertdialog");
  // Przycisk bywa kliknięty przed hydratacją strony: ponawiamy, aż otworzy się potwierdzenie.
  await expect(async () => {
    await remove.click();
    await expect(confirm).toBeVisible({ timeout: 1000 });
  }).toPass();
  await confirm.getByRole("button", { name: "Usuń" }).click();
  await expect(remove).toHaveCount(0);
}

// Zapisuje z powrotem wpis snu odczytany na początku testu.
async function restoreSleep(page: Page, original: SleepSnapshot) {
  await page.goto("/nawyki");
  const sleepForm = page.getByRole("form", { name: "Wpis snu" });
  await expect(sleepForm.getByRole("button", { name: "Zapisz" })).toBeVisible();
  await sleepForm.getByLabel("Zasnąłem").fill(original.sleptAt);
  await sleepForm.getByLabel("Obudziłem się").fill(original.wokeAt);
  if (original.feeling) {
    await sleepForm.getByRole("radiogroup", { name: "Samopoczucie" }).getByRole("radio", { name: original.feeling, exact: true }).click();
  }
  await sleepForm.getByLabel("Notatka").fill(original.note);
  await sleepForm.getByRole("button", { name: "Zapisz" }).click();
  await expect(sleepForm.getByRole("button", { name: "Usuń" })).toBeVisible();
}

test("nawyki, sen i ekran Dziś: utworzenie, odhaczenie, zapis snu, archiwizacja", async ({ page }) => {
  // Unikalna nazwa, żeby nawyki z wcześniejszych przebiegów nie myliły selektorów.
  const name = `Woda e2e ${Date.now()}`;

  await signIn(page);
  const originalSleep = await readTodaySleep(page);
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
      page
        .waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/dzis"))
        .then((response) => expect(response.ok()).toBe(true)),
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
    // Sprzątanie: każdy krok osobno, żeby błąd sprzątania nie przykrył błędu testu ani nie pominął kolejnych kroków.
    try {
      await deleteTodaySleepIfAny(page);
      if (originalSleep) await restoreSleep(page, originalSleep);
    } catch (error) {
      console.warn("Sprzątanie snu nie powiodło się (sprawdź wpis z dzisiejszej nocy ręcznie):", error);
    }
    try {
      await page.goto("/nawyki");
      const leftover = page.getByRole("button", { name, exact: true });
      if ((await leftover.count()) > 0) {
        await leftover.click();
        await page.getByRole("dialog").getByRole("button", { name: "Archiwizuj" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Archiwizuj" }).click();
        await expect(leftover).toHaveCount(0);
      }
    } catch (error) {
      console.warn(`Sprzątanie nawyku "${name}" nie powiodło się (zarchiwizuj go ręcznie):`, error);
    }
  }
});
