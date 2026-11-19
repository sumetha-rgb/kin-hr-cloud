import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: { default: "KIN HR", template: "%s · KIN HR" },
  description: "ระบบบริหารงานบุคคล KIN Rehabilitation & Homecare · ลงเวลาด้วยลายนิ้วมือบนมือถือ",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/kin-logo.png" },
  appleWebApp: { capable: true, title: "KIN HR", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
