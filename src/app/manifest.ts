import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rhytm",
    short_name: "Rhytm",
    lang: "pl",
    start_url: "/kalendarz",
    display: "standalone",
    theme_color: "#191816",
    background_color: "#FBFAF7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
