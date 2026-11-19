import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { branches, departments, employees, leaveTypes, payrollItems, payrollRuns, positions, requests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { loadAttendance } from "@/lib/attendance-data";
import { csvResponse } from "@/lib/csv";
import { bkkDateStr } from "@/lib/time";
import { fullName, STATUS_LABEL } from "@/lib/util";

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function GET(req: Request, ctx: { params: Promise<{ type: string }> }) {
  const u = await getCurrentUser();
  if (!u || (u.role !== "admin" && u.role !== "hr")) return new Response("Forbidden", { status: 403 });
  const { type } = await ctx.params;
  const q = new URL(req.url).searchParams;

  switch (type) {
    case "employees": {
      const rows = await db
        .select({ e: employees, branch: branches.name, dept: departments.name, pos: positions.name })
        .from(employees)
        .leftJoin(branches, eq(employees.branchId, branches.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(positions, eq(employees.positionId, positions.id))
        .orderBy(asc(employees.code));
      return csvResponse(`employees-${bkkDateStr()}.csv`, [
        ["รหัส", "คำนำหน้า", "ชื่อ", "นามสกุล", "ชื่อเล่น", "เลขบัตรประชาชน", "โทร", "อีเมล", "สาขา", "แผนก", "ตำแหน่ง", "วันเริ่มงาน", "สถานะ", "ประเภทจ่าย", "เงินเดือน/ค่าแรง"],
        ...rows.map(({ e, branch, dept, pos }) => [
          e.code,
          e.prefix,
          e.firstName,
          e.lastName,
          e.nickname,
          e.nationalId,
          e.phone,
          e.email,
          branch,
          dept,
          pos,
          e.startDate,
          STATUS_LABEL[e.status],
          e.payType === "monthly" ? "รายเดือน" : "รายวัน",
          e.baseSalary,
        ]),
      ]);
    }

    case "attendance": {
      const start = q.get("start");
      const end = q.get("end");
      if (!isDate(start) || !isDate(end) || end < start) return new Response("ช่วงวันที่ไม่ถูกต้อง", { status: 400 });
      const rows = await loadAttendance({ start, end, includeResigned: true });
      return csvResponse(`attendance-${start}-${end}.csv`, [
        ["รหัส", "ชื่อ-สกุล", "วันทำงาน", "มาทำงาน", "มาสาย(ครั้ง)", "สาย(นาที)", "ขาด", "ลา(รับเงิน)", "ลา(ไม่รับเงิน)", "ลงเวลาไม่ครบ"],
        ...rows.map(({ employee: e, totals: t }) => [e.code, fullName(e), t.scheduled, t.worked, t.lateCount, t.lateMinutes, t.absent, t.paidLeave, t.unpaidLeave, t.incomplete]),
      ]);
    }

    case "attendance-daily": {
      const start = q.get("start");
      const end = q.get("end");
      if (!isDate(start) || !isDate(end) || end < start) return new Response("ช่วงวันที่ไม่ถูกต้อง", { status: 400 });
      const rows = await loadAttendance({ start, end, includeResigned: true });
      const hhmm = (d?: Date) => (d ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).format(d) : "");
      return csvResponse(`attendance-daily-${start}-${end}.csv`, [
        ["วันที่", "รหัส", "ชื่อ-สกุล", "เข้า", "ออก", "ชั่วโมงงาน", "สาย(นาที)", "ออกก่อน(นาที)", "สถานะ"],
        ...rows.flatMap(({ employee: e, days }) =>
          days
            .filter((d) => d.status !== "not_employed")
            .map((d) => [d.date, e.code, fullName(e), hhmm(d.firstIn), hhmm(d.lastOut), (d.workedMinutes / 60).toFixed(2), d.lateMinutes, d.earlyMinutes, d.leave?.name ?? d.holiday ?? d.status]),
        ),
      ]);
    }

    case "leave": {
      const year = Number(q.get("year")) || Number(bkkDateStr().slice(0, 4));
      const rows = await db
        .select({
          code: employees.code,
          prefix: employees.prefix,
          firstName: employees.firstName,
          lastName: employees.lastName,
          leave: leaveTypes.name,
          days: sql<string>`sum(${requests.days})`,
        })
        .from(requests)
        .innerJoin(employees, eq(requests.employeeId, employees.id))
        .innerJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
        .where(and(eq(requests.type, "leave"), eq(requests.status, "approved"), gte(requests.startDate, `${year}-01-01`), lte(requests.startDate, `${year}-12-31`)))
        .groupBy(employees.id, leaveTypes.id)
        .orderBy(asc(employees.code));
      return csvResponse(`leave-${year}.csv`, [["รหัส", "ชื่อ-สกุล", "ประเภทการลา", "จำนวนวัน"], ...rows.map((r) => [r.code, fullName(r), r.leave, Number(r.days)])]);
    }

    case "payroll":
    case "bank":
    case "sso": {
      const runId = Number(q.get("runId"));
      const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, runId));
      if (!run) return new Response("ไม่พบงวด", { status: 404 });
      const items = await db
        .select({ i: payrollItems, e: employees })
        .from(payrollItems)
        .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
        .where(eq(payrollItems.runId, runId))
        .orderBy(asc(employees.code));
      const period = `${run.year}-${String(run.month).padStart(2, "0")}`;

      if (type === "payroll") {
        return csvResponse(`payroll-${period}.csv`, [
          ["รหัส", "ชื่อ-สกุล", "ประเภท", "ฐาน", "วันทำงาน", "ขาด", "สาย(นาที)", "OT(ชม.)", "เงินได้", "OT", "เงินเพิ่ม", "รายได้อื่น", "รวมรายได้", "หักสาย", "ประกันสังคม", "ภาษี", "รายหักอื่น", "สุทธิ"],
          ...items.map(({ i, e }) => [
            e.code,
            fullName(e),
            i.payType === "monthly" ? "รายเดือน" : "รายวัน",
            i.baseSalary,
            i.workedDays,
            i.absentDays,
            i.lateMinutes,
            i.otHours,
            i.earnedSalary,
            i.otAmount,
            i.allowance,
            i.otherIncome,
            i.gross,
            i.lateDeduction,
            i.sso,
            i.tax,
            i.otherDeduction,
            i.net,
          ]),
        ]);
      }
      if (type === "bank") {
        return csvResponse(`bank-transfer-${period}.csv`, [
          ["ลำดับ", "รหัส", "ชื่อบัญชี", "ธนาคาร", "เลขบัญชี", "จำนวนเงิน"],
          ...items.map(({ i, e }, n) => [n + 1, e.code, fullName(e), e.bankName, e.bankAccount, i.net]),
        ]);
      }
      // ข้อมูลสำหรับยื่นเงินสมทบประกันสังคม (สปส.1-10) — นำไปกรอก/แปลงตามรูปแบบไฟล์ของ e-Service
      const ssoRows = items.filter(({ i }) => Number(i.sso) > 0);
      return csvResponse(`sso-${period}.csv`, [
        ["ลำดับ", "เลขประจำตัวประชาชน", "คำนำหน้า", "ชื่อ", "นามสกุล", "ค่าจ้าง", "เงินสมทบลูกจ้าง", "เงินสมทบนายจ้าง"],
        ...ssoRows.map(({ i, e }, n) => [n + 1, e.nationalId, e.prefix, e.firstName, e.lastName, (Number(i.earnedSalary) - Number(i.lateDeduction)).toFixed(2), i.sso, i.sso]),
      ]);
    }
  }
  return new Response("ไม่พบรายงาน", { status: 404 });
}
