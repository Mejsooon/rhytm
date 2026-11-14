import { clerkSetup } from "@clerk/testing/playwright";
import { missingEnv } from "./e2e-env";

// Pobiera token testowy Clerka (Testing Token). Bez kluczy nic nie robi, a spec i tak jest pomijany.
export default async function globalSetup() {
  if (missingEnv.length > 0) return;
  await clerkSetup();
}
