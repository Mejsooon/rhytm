import { describe, expect, it } from "vitest";
import { validateProfile } from "@/lib/profile-validation";

const valid = {
  weight_kg: "80",
  height_cm: "180",
  birth_date: "1999-05-20",
  sex: "M",
  timezone: "Europe/Warsaw",
};

describe("validateProfile", () => {
  it("przyjmuje poprawne dane i zamienia liczby", () => {
    const result = validateProfile(valid);
    expect(result).toEqual({
      ok: true,
      value: { weight_kg: 80, height_cm: 180, birth_date: "1999-05-20", sex: "M", timezone: "Europe/Warsaw" },
    });
  });

  it("puste pola opcjonalne zapisuje jako null", () => {
    const result = validateProfile({ ...valid, weight_kg: "", height_cm: "", birth_date: "", sex: "" });
    expect(result).toEqual({
      ok: true,
      value: { weight_kg: null, height_cm: null, birth_date: null, sex: null, timezone: "Europe/Warsaw" },
    });
  });

  it("przyjmuje granice zakresów", () => {
    expect(validateProfile({ ...valid, weight_kg: "30", height_cm: "100" }).ok).toBe(true);
    expect(validateProfile({ ...valid, weight_kg: "300", height_cm: "250" }).ok).toBe(true);
  });

  it.each([
    ["weight_kg", "29.9", "Waga musi mieścić się w zakresie 30–300 kg."],
    ["weight_kg", "301", "Waga musi mieścić się w zakresie 30–300 kg."],
    ["weight_kg", "abc", "Waga musi mieścić się w zakresie 30–300 kg."],
    ["height_cm", "99", "Wzrost musi mieścić się w zakresie 100–250 cm."],
    ["height_cm", "251", "Wzrost musi mieścić się w zakresie 100–250 cm."],
    ["birth_date", "2999-01-01", "Data urodzenia musi być poprawną datą z przeszłości."],
    ["birth_date", "2020-02-31", "Data urodzenia musi być poprawną datą z przeszłości."],
    ["birth_date", "nie-data", "Data urodzenia musi być poprawną datą z przeszłości."],
    ["sex", "X", "Wybierz płeć: mężczyzna lub kobieta."],
    ["timezone", "Mars/Olympus", "Wybierz poprawną strefę czasową."],
    ["timezone", "", "Wybierz poprawną strefę czasową."],
  ])("odrzuca %s = %j", (field, value, message) => {
    const result = validateProfile({ ...valid, [field]: value });
    expect(result).toEqual({ ok: false, errors: { [field]: message } });
  });

  it("zbiera błędy z kilku pól naraz", () => {
    const result = validateProfile({ ...valid, weight_kg: "1", height_cm: "1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["weight_kg", "height_cm"]);
  });
});
