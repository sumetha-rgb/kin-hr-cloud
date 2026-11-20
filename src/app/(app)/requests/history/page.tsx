import { and, desc, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, leaveTypes, requests, users } from "@/db/schema";
import { Table } from "@/components/ui";
import { historyWhere } from "@/lib/approval";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { fullName } from "@/lib/util";
import { RequestSummary, StatusBadge, TypeBadge } from "../request-detail";

export const metadata = { title: "ประวัติการอนุมัติ" };

export default async function History() {
  const u = await requireUser();
  if (u.role === "employee") redirect("/requests/mine");
  // ผู้ตัดสินขั้นสุดท้าย และหัวหน้าที่อนุมัติขั้นแรก (ชื่อจริงถ้ามี)
  const finalUser = alias(users, "final_user");
  const finalEmp = alias(employees, "final_emp");
  const headUser = alias(users, "head_user");
  const headEmp = alias(employees, "head_emp");
  const rows = await db
    .select({
      r: requests,
      e: employees,
      leaveName: leaveTypes.name,
      by: finalUser.username,
      byName: finalEmp.firstName,
      headBy: headUser.username,
      headName: headEmp.firstName,
    })
    .from(requests)
    .innerJoin(employees, eq(requests.employeeId, employees.id))
    .leftJoin(leaveTypes, eq(requests.leaveTypeId, leaveTypes.id))
    .leftJoin(finalUser, eq(requests.decidedBy, finalUser.id))
    .leftJoin(finalEmp, eq(finalUser.employeeId, finalEmp.id))
    .leftJoin(headUser, eq(requests.headApprovedBy, headUser.id))
    .leftJoin(headEmp, eq(headUser.employeeId, headEmp.id))
    .where(and(ne(requests.status, "pending"), historyWhere(u)))
    .orderBy(desc(requests.decidedAt), desc(requests.createdAt))
    .limit(200);

  return (
    <Table head={["พนักงาน", "ประเภท", "รายละเอียด", "สถานะ", "ผู้อนุมัติ", "เมื่อ"]} empty={!rows.length}>
      {rows.map(({ r, e, leaveName, by, byName, headBy, headName }) => {
        const head = headName ?? headBy;
        const final = byName ?? by;
        return (
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
            <td className="text-sm text-stone-600">
              {r.status === "cancelled" ? (
                "พนักงานยกเลิก"
              ) : (
                <>
                  {head && head !== final && <span className="block text-xs text-stone-500">หัวหน้า: {head}</span>}
                  <span className="block">
                    {final ?? "-"}
                    {r.type === "ot" && head === final ? <span className="text-xs text-stone-400"> (หัวหน้า)</span> : null}
                  </span>
                </>
              )}
            </td>
            <td className="whitespace-nowrap text-stone-500">{fmtDateTime(r.decidedAt ?? r.createdAt)}</td>
          </tr>
        );
      })}
    </Table>
  );
}
