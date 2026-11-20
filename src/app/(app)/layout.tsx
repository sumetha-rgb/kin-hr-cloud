import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, warnings } from "@/db/schema";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { pendingForUser } from "@/lib/approval";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/util";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const hr = user.role === "admin" || user.role === "hr";
  const mgr = hr || user.role === "manager";
  const [[{ n: unread }], myWarn] = await Promise.all([
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    // ใบเตือนของตัวเอง (ไม่นับที่ยกเลิก) — มีเมื่อไหร่จึงแสดงเมนู "ใบเตือนของฉัน"
    !hr && user.employeeId
      ? db
          .select({
            total: count(),
            pending: count(sql`case when ${warnings.acknowledgedAt} is null then 1 end`),
          })
          .from(warnings)
          .where(and(eq(warnings.employeeId, user.employeeId), isNull(warnings.voidedAt)))
      : Promise.resolve([{ total: 0, pending: 0 }]),
  ]);
  const myWarnings = myWarn[0];
  // ตัวเลขบนเมนู "อนุมัติคำขอ" = คำขอที่รอ "คุณ" ตัดสิน ณ ขั้นปัจจุบัน
  const pendingApprovals = mgr ? (await pendingForUser(user)).length : 0;

  // ชื่อเมนูภาษาไทยล้วน บอกว่ากดแล้วทำอะไรได้ (บรรทัดรองเป็นตัวอย่างสิ่งที่อยู่ข้างใน)
  // หัวหน้า/HR แบ่ง 2 หมวด: "ของฉัน" (เรื่องของตัวเอง) กับ "งานจัดการ" (ทำให้คนอื่น) — พนักงานทั่วไปไม่มีหมวด
  const ME = mgr ? "ของฉัน" : undefined;
  const MANAGE = "งานจัดการ";
  const home: NavItem = { href: "/", label: "หน้าหลัก", icon: "home" };
  const scan: NavItem = {
    href: "/checkin",
    label: "สแกนนิ้วลงเวลา",
    sub: "เข้างาน / ออกงาน",
    short: "สแกนนิ้ว",
    icon: "finger",
    section: ME,
  };
  const myRequests: NavItem = {
    href: "/requests/mine",
    match: ["/requests/new"],
    label: mgr ? "คำขอของฉัน" : "ยื่นลา / OT",
    sub: "ยื่นลา ขอ OT ขอแก้เวลา",
    short: "ลา/OT",
    icon: "document",
    section: ME,
  };
  const myAttendance: NavItem = {
    href: "/attendance/me",
    label: "เวลาทำงานของฉัน",
    sub: "ปฏิทินเข้า-ออกงาน",
    short: "เวลางาน",
    icon: "clock",
    section: ME,
  };
  const mySlips: NavItem = {
    href: "/payroll/my",
    label: mgr ? "สลิปเงินเดือนของฉัน" : "สลิปเงินเดือน",
    sub: "ดูสลิปย้อนหลัง",
    short: "สลิป",
    icon: "money",
    section: ME,
  };
  const approve: NavItem = {
    href: "/requests/inbox",
    match: ["/requests/history"],
    label: "อนุมัติคำขอ",
    sub: hr ? "ลา OT แก้เวลา ทุกคน" : "ลา OT แก้เวลา ของลูกทีม",
    short: "อนุมัติ",
    icon: "check",
    badge: pendingApprovals,
    section: MANAGE,
  };
  const teamAttendance: NavItem = {
    href: "/attendance",
    label: hr ? "เวลาทำงานพนักงาน" : "เวลาทำงานลูกทีม",
    sub: "มาสาย ขาด ลา รายการสแกน",
    short: "เวลางาน",
    icon: "clock",
    section: MANAGE,
  };
  const personnel: NavItem = {
    href: "/personnel",
    label: "พนักงาน",
    sub: "ข้อมูลพนักงาน บัญชีผู้ใช้",
    short: "พนักงาน",
    icon: "people",
    section: MANAGE,
  };

  const items: NavItem[] = [
    home,
    {
      href: "/notifications",
      label: "การแจ้งเตือน",
      icon: "bell",
      badge: unread,
    },
    // ของฉัน
    ...(user.employeeId ? [scan, myRequests, myAttendance, mySlips] : []),
    ...(!hr && myWarnings.total > 0
      ? [
          {
            href: "/warnings",
            label: "ใบเตือนของฉัน",
            sub: "อ่านและกดรับทราบ",
            icon: "flag",
            badge: myWarnings.pending,
            section: ME,
          },
        ]
      : []),
    { href: "/account", label: "โปรไฟล์ของฉัน", icon: "user", section: ME },
    // งานจัดการ
    ...(mgr ? [approve, teamAttendance] : []),
    ...(hr
      ? [
          personnel,
          {
            href: "/payroll",
            label: "เงินเดือน",
            sub: "คำนวณ ปิดงวด ออกสลิป",
            icon: "money",
            section: MANAGE,
          },
          {
            href: "/warnings",
            label: "ใบเตือน",
            sub: "ออกใบเตือน ประวัติวินัย",
            icon: "flag",
            section: MANAGE,
          },
          {
            href: "/reports",
            label: "รายงาน",
            sub: "ดาวน์โหลด Excel",
            icon: "chart",
            section: MANAGE,
          },
          {
            href: "/organization",
            label: "ตั้งค่าองค์กร",
            sub: "สาขา แผนก กะ วันหยุด",
            icon: "org",
            section: MANAGE,
          },
          {
            href: "/admin",
            label: "ดูแลระบบ",
            sub: "บัญชีผู้ใช้ ประวัติ ตั้งค่า",
            icon: "shield",
            section: MANAGE,
          },
        ]
      : []),
  ];

  // แถบล่างมือถือ: ปุ่มสแกนนิ้วอยู่กลาง (ช่องที่ 3)
  const mobileItems: NavItem[] = user.employeeId
    ? mgr
      ? [home, approve, scan, myRequests]
      : [home, myAttendance, scan, myRequests]
    : [home, approve, personnel, teamAttendance];

  return (
    <div className="min-h-dvh">
      <Sidebar
        items={items}
        mobileItems={mobileItems}
        user={{
          name: user.displayName,
          role: ROLE_LABEL[user.role],
          employeeId: user.employeeId,
          photoVersion: user.photoVersion,
        }}
        logoutAction={logout}
        unread={unread}
      />
      <main className="px-4 pt-5 pb-32 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="animate-in mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
