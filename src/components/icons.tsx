import { cn } from "@/lib/util";

/**
 * ชุดไอคอนเส้น (stroke) ของทั้งระบบ — ใช้แทนอิโมจิเสมอ (ห้ามใช้อิโมจิใน UI)
 * ขนาด 24×24, เส้น 1.8, สีตาม currentColor
 */
export const ICONS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  finger: "M12 11v6m-4-4c0-2.2 1.8-4 4-4s4 1.8 4 4v1m-12-1a8 8 0 0 1 16 0v2M7 19a10 10 0 0 0 1-4",
  org: "M4 21V7l8-4 8 4v14M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01",
  people: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m20 0v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  check: "M9 12l2 2 4-4M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2",
  money: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 7V5h12v2",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  menu: "M4 6h16M4 12h16M4 18h16",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4",
  // สัญลักษณ์ทั่วไป
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  alert: "M12 9v4m0 3.5h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: "M12 16v-4m0-3.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  checkCircle: "M8.5 12.5l2.5 2.5 4.5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  megaphone: "M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1zm13.5-2a5 5 0 0 1 0 8",
  printer: "M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z",
  document: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6m-6 4h4",
  logIn: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  logOut: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  flag: "M4 22V4m0 0h12l-2 4 2 4H4",
  plus: "M12 5v14M5 12h14",
  locate:"M12 2v3m0 14v3M2 12h3m14 0h3M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "size-5", strokeWidth = 1.8 }: { name: IconName | (string & {}); className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name as IconName] ?? ICONS.home} />
    </svg>
  );
}
