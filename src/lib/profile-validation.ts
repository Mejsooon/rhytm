export type ProfileInput = {
  weight_kg: string;
  height_cm: string;
  birth_date: string;
  sex: string;
  timezone: string;
  sleep_goal_min: string;
};

export type ProfileValues = {
  weight_kg: number | null;
  height_cm: number | null;
  birth_date: string | null;
  sex: "M" | "K" | null;
  timezone: string;
  sleep_goal_min: number;
};

export type ProfileValidation =
  | { ok: true; value: ProfileValues }
  | { ok: false; errors: Partial<Record<keyof ProfileInput, string>> };

// Czysta walidacja formularza profilu (wartości jako tekst z FormData).
// Puste waga, wzrost, data i płeć są dozwolone i zapisują się jako null.
export function validateProfile(input: ProfileInput): ProfileValidation {
  const errors: Partial<Record<keyof ProfileInput, string>> = {};
  const value: ProfileValues = {
    weight_kg: null,
    height_cm: null,
    birth_date: null,
    sex: null,
    timezone: input.timezone,
    sleep_goal_min: 480,
  };

  if (input.weight_kg.trim() !== "") {
    const weight = Number(input.weight_kg.replace(",", "."));
    if (Number.isFinite(weight) && weight >= 30 && weight <= 300) value.weight_kg = weight;
    else errors.weight_kg = "Waga musi mieścić się w zakresie 30–300 kg.";
  }

  if (input.height_cm.trim() !== "") {
    const height = Number(input.height_cm.replace(",", "."));
    if (Number.isFinite(height) && height >= 100 && height <= 250) value.height_cm = height;
    else errors.height_cm = "Wzrost musi mieścić się w zakresie 100–250 cm.";
  }

  if (input.birth_date !== "") {
    // Data musi mieć format RRRR-MM-DD, istnieć w kalendarzu (bez 31 lutego) i być w przeszłości.
    const parsed = new Date(`${input.birth_date}T00:00:00Z`);
    const wellFormed =
      /^\d{4}-\d{2}-\d{2}$/.test(input.birth_date) &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === input.birth_date;
    if (wellFormed && parsed.getTime() < Date.now()) value.birth_date = input.birth_date;
    else errors.birth_date = "Data urodzenia musi być poprawną datą z przeszłości.";
  }

  if (input.sex !== "") {
    if (input.sex === "M" || input.sex === "K") value.sex = input.sex;
    else errors.sex = "Wybierz płeć: mężczyzna lub kobieta.";
  }

  // Cel snu jako „G” albo „G:MM”; puste pole oznacza domyślne 8 godzin.
  if (input.sleep_goal_min.trim() !== "") {
    const match = /^(\d{1,2})(?::([0-5]\d))?$/.exec(input.sleep_goal_min.trim());
    const minutes = match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : NaN;
    if (minutes >= 240 && minutes <= 720 && minutes % 15 === 0) value.sleep_goal_min = minutes;
    else errors.sleep_goal_min = "Cel snu musi wynosić od 4 do 12 godzin (co 15 minut).";
  }

  if (!Intl.supportedValuesOf("timeZone").includes(input.timezone)) {
    errors.timezone = "Wybierz poprawną strefę czasową.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
