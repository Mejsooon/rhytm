import { LogoMark } from "@/components/brand/LogoMark";

// Układ stron logowania i rejestracji: formularz po lewej, ciemny panel po prawej.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <span className="font-heading text-3xl font-extrabold">rhytm</span>
        </div>
        {children}
      </div>
      <div className="hidden flex-col items-start justify-center gap-3 bg-[#191816] p-16 text-white lg:flex">
        <p className="font-heading text-4xl font-extrabold">Your day, in one rhythm.</p>
        <p className="text-lg text-white/70">Plan it. Do it. Watch it grow.</p>
      </div>
    </div>
  );
}
