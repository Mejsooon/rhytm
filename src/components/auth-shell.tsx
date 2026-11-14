// Układ stron logowania i rejestracji: formularz po lewej, ciemny panel po prawej.
export function AuthShell({ children }: { children: React.ReactNode }) {
  const cells = [
    "#EF8A55", "#DF6C32", "#B64E10",
    "#F9A782", "#EF8A55", "#DF6C32",
    "#FFDBCA", "#F9A782", "#EF8A55",
  ];
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center gap-8 p-6">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 96 96" aria-hidden="true">
            {cells.map((fill, i) => (
              <rect
                key={i}
                x={(i % 3) * 34}
                y={Math.floor(i / 3) * 34}
                width="28"
                height="28"
                rx="7"
                fill={fill}
              />
            ))}
          </svg>
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
