"use client";

import { useState, useTransition } from "react";
import { UserProfile } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { updateProfile, type UpdateProfileResult } from "./actions";

type Profile = {
  weight_kg: number | null;
  height_cm: number | null;
  birth_date: string | null;
  sex: string | null;
  timezone: string;
  sleep_goal_min: number;
};

export function SettingsTabs({ profile, timezones }: { profile: Profile; timezones: string[] }) {
  const [sex, setSex] = useState(profile.sex ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [result, setResult] = useState<UpdateProfileResult | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? result.errors : {};

  return (
    <Tabs defaultValue="profil">
      <TabsList>
        <TabsTab value="profil">Profil</TabsTab>
        <TabsTab value="konto">Konto</TabsTab>
      </TabsList>

      <TabsPanel value="profil" className="pt-4">
        <Form
          className="flex max-w-md flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => setResult(await updateProfile(formData)));
          }}
        >
          <Field name="weight_kg" invalid={!!errors.weight_kg}>
            <FieldLabel>Waga (kg)</FieldLabel>
            <Input type="number" step="0.1" min={30} max={300} defaultValue={profile.weight_kg ?? ""} />
            {errors.weight_kg && <FieldError match>{errors.weight_kg}</FieldError>}
          </Field>

          <Field name="height_cm" invalid={!!errors.height_cm}>
            <FieldLabel>Wzrost (cm)</FieldLabel>
            <Input type="number" step="1" min={100} max={250} defaultValue={profile.height_cm ?? ""} />
            {errors.height_cm && <FieldError match>{errors.height_cm}</FieldError>}
          </Field>

          <Field name="birth_date" invalid={!!errors.birth_date}>
            <FieldLabel>Data urodzenia</FieldLabel>
            <Input type="date" defaultValue={profile.birth_date ?? ""} />
            {errors.birth_date && <FieldError match>{errors.birth_date}</FieldError>}
          </Field>

          <div className="flex flex-col items-start gap-2">
            <span id="sex-label" className="font-medium text-base/4.5 sm:text-sm/4">Płeć</span>
            <input type="hidden" name="sex" value={sex} />
            <SegmentedControl aria-labelledby="sex-label" role="group">
              {[
                { value: "M", label: "Mężczyzna" },
                { value: "K", label: "Kobieta" },
              ].map((option) => (
                <SegmentedControlItem
                  key={option.value}
                  aria-pressed={sex === option.value}
                  data-checked={sex === option.value ? "" : undefined}
                  onClick={() => setSex(option.value)}
                >
                  {option.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            {errors.sex && <p className="text-destructive-foreground text-xs">{errors.sex}</p>}
          </div>

          <Field name="timezone" invalid={!!errors.timezone}>
            <FieldLabel>Strefa czasowa</FieldLabel>
            <Select value={timezone} onValueChange={(value) => setTimezone(value as string)} name="timezone">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <FieldDescription>Bloki powtarzane zostają o tej samej godzinie także po zmianie czasu.</FieldDescription>
            {errors.timezone && <FieldError match>{errors.timezone}</FieldError>}
          </Field>

          <Field name="sleep_goal_min" invalid={!!errors.sleep_goal_min}>
            <FieldLabel>Cel snu</FieldLabel>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="8:00"
              defaultValue={`${Math.floor(profile.sleep_goal_min / 60)}:${String(profile.sleep_goal_min % 60).padStart(2, "0")}`}
            />
            <FieldDescription>Linia celu na wykresie snu. Od 4 do 12 godzin.</FieldDescription>
            {errors.sleep_goal_min && <FieldError match>{errors.sleep_goal_min}</FieldError>}
          </Field>

          {"form" in errors && errors.form && <p className="text-destructive-foreground text-sm">{errors.form}</p>}
          {result?.ok && <p role="status" className="text-sm text-[#05893E]">Zapisano zmiany.</p>}

          <Button type="submit" disabled={pending} className="self-start">
            Zapisz zmiany
          </Button>
        </Form>
      </TabsPanel>

      <TabsPanel value="konto" className="pt-4">
        <UserProfile routing="hash" />
      </TabsPanel>
    </Tabs>
  );
}
