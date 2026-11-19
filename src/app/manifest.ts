import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KIN HR · KIN Rehabilitation & Homecare",
    short_name: "KIN HR",
    description: "ระบบบริหารงานบุคคล ลงเวลาด้วยลายนิ้วมือบนมือถือ",
    start_url: "/checkin",
    display: "standalone",
    background_color: "#faf7f4",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/kin-logo.png", sizes: "120x120", type: "image/png" },
    ],
  };
}
