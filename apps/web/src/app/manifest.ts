import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InvestMap",
    short_name: "InvestMap",
    description: "Interactive investment map",
    start_url: "/",
    display: "browser",
    background_color: "#f7f8f6",
    theme_color: "#0b6b57",
    icons: [{ src: "/icon", sizes: "64x64", type: "image/png" }],
  };
}
