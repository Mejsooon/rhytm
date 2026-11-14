// Zmienne potrzebne do testu e2e. Gdy którejś brakuje, cały spec jest pomijany z czytelnym powodem.
export const REQUIRED_ENV = [
  "E2E_CLERK_USER_EMAIL",
  "E2E_CLERK_USER_PASSWORD",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

export const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
