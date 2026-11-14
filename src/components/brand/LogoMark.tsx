// Znak Rhytm: siatka 3×3 w odcieniach pomarańczu. Kolejność kolorów zależy od tła.
const cellsByBackground = {
  light: [
    "#EF8A55", "#DF6C32", "#B64E10",
    "#F9A782", "#EF8A55", "#DF6C32",
    "#FFDBCA", "#F9A782", "#EF8A55",
  ],
  dark: [
    "#EF8A55", "#F9A782", "#FFDBCA",
    "#DF6C32", "#EF8A55", "#F9A782",
    "#7C350E", "#B64E10", "#DF6C32",
  ],
};

export function LogoMark({
  size = 40,
  background = "light",
}: {
  size?: number;
  background?: "light" | "dark";
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      {cellsByBackground[background].map((fill, i) => (
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
  );
}
