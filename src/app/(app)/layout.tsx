import { Sidebar, type NavItem } from "@/components/sidebar";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/util";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const hr = user.role === "admin" || user.role === "hr";
  const mgr = hr || user.role === "manager";

  const home: NavItem = { href: "/", label: "หน้าหลัก", icon: "home" };
  const scan: NavItem = { href: "/checkin", label: "สแกนนิ้วลงเวลา", short: "สแกนนิ้ว", icon: "finger" };
  const attendance: NavItem = mgr
    ? { href: "/attendance", label: "Time Attendance", sub: "ระบบลงเวลาเข้าออกของพนักงาน", short: "เวลางาน", icon: "clock" }
    : { href: "/attendance/me", label: "เวลาทำงานของฉัน", short: "เวลางาน", icon: "clock" };
  const approve: NavItem = { href: "/requests", label: "Approve Center", sub: "ระบบอนุมัติเอกสารออนไลน์", short: mgr ? "อนุมัติ" : "ลา/OT", icon: "check" };
  const payroll: NavItem = hr
    ? { href: "/payroll", label: "Payroll", sub: "ระบบคำนวณเงินเดือนอัตโนมัติ", short: "เงินเดือน", icon: "money" }
    : { href: "/payroll/my", label: "สลิปเงินเดือน", short: "สลิป", icon: "money" };
  const personnel: NavItem = { href: "/personnel", label: "Personnel", sub: "ระบบจัดการข้อมูลพนักงาน", short: "พนักงาน", icon: "people" };

  const items: NavItem[] = [
    home,
    ...(user.employeeId ? [scan] : []),
    ...(hr ? [{ href: "/organization", label: "Organization", sub: "ระบบจัดการองค์กร", icon: "org" }, personnel] : []),
    attendance,
    approve,
    payroll,
    ...(hr ? [{ href: "/reports", label: "Report", sub: "รายงาน", icon: "chart" }] : []),
    { href: "/account", label: "บัญชีของฉัน", icon: "user" },
  ];

  // แถบล่างมือถือ: ปุ่มสแกนนิ้วอยู่กลาง (ช่องที่ 3)
  const mobileItems: NavItem[] = user.employeeId
    ? [home, attendance, scan, hr ? personnel : approve]
    : hr
      ? [home, personnel, attendance, approve]
      : [home, attendance, approve, payroll];

  return (
    <div className="min-h-dvh">
      <Sidebar items={items} mobileItems={mobileItems} user={{ name: user.displayName, role: ROLE_LABEL[user.role] }} logoutAction={logout} />
      <main className="px-4 pt-4 pb-28 sm:px-6 lg:ml-64 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
