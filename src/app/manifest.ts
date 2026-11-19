import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KIN HR · KIN Rehabilitation & Homecare",
    short_name: "KIN HR",
    description: "ระบบบริหารงานบุคคล ลงเวลาด้วยลายนิ้วมือบนมือถือ",
    lang: "th",
    start_url: "/checkin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    // Android ต้องมี PNG 192 + 512 จึงจะติดตั้งเป็นแอปได้ · maskable = ไอคอนที่ระบบตัดเป็นวงกลม/สี่เหลี่ยมมนเองได้
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "สแกนนิ้วลงเวลา", short_name: "ลงเวลา", url: "/checkin", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "ยื่นลา / OT", short_name: "ยื่นลา", url: "/requests/new", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
