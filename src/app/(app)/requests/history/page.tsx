import { and, desc, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, leaveTypes, requests, users } from "@/db/schema";
import { Table } from "@/components/ui";
import { approvableWhere } from "@/lib/approval";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/util";
import { RequestSummary, StatusBadge, TypeBadge } from "../request-detail";

export const metadata = { title: "ประวัติการอนุมัติ" };

export default async function History() {
  const u = await requireUser();
  if (u.role === "employee") redirect("/requests/mine");
  const rows = await db
    .select({ r: requests, e: employees, leaveName: leaveTypes.name, by: users.username })
    .from(requests)
    .innerJoin(employees, eq(requests.employeeId, employees.id))
    .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
    .leftJoin(users, eq(requests.decidedBy, users.id))
    .where(and(ne(requests.status, "pending"), approvableWhere(u)))
    .orderBy(desc(requests.decidedAt), desc(requests.createdAt))
    .limit(200);

  return (
    <Table head={["พนักงาน", "ประเภท", "รายละเอียด", "สถานะ", "โดย", "เมื่อ"]} empty={!rows.length}>
      {rows.map(({ r, e, leaveName, by }) => (
        <tr key={r.id}>
          <td>
            {fullName(e)} <span className="text-xs text-stone-400">{e.code}</span>
          </td>
          <td>
            <TypeBadge type={r.type} />
          </td>
          <td>
            <RequestSummary r={r} leaveName={leaveName} />
          </td>
          <td>
            <StatusBadge r={r} />
            {r.decisionNote && <div className="text-xs text-stone-400">{r.decisionNote}</div>}
          </td>
          <td className="text-stone-500">{by ?? (r.status === "cancelled" ? "พนักงานยกเลิก" : "-")}</td>
          <td className="whitespace-nowrap text-stone-500">{fmtDateTime(r.decidedAt ?? r.createdAt)}</td>
        </tr>
      ))}
    </Table>
  );
}
