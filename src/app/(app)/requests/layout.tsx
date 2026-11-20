import { requireUser } from "@/lib/auth";
import { RequestsNav } from "./requests-nav";

export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  return (
    <>
      <RequestsNav canSubmit={!!u.employeeId} approver={u.role !== "employee"} hr={u.role === "admin" || u.role === "hr"} />
      {children}
    </>
  );
}
