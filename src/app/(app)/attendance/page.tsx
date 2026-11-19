import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function AttendanceIndex() {
  const u = await requireUser();
  redirect(u.role === "employee" ? "/attendance/me" : "/attendance/board");
}
