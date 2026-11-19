import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function RequestsIndex({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  redirect((u.employeeId ? "/requests/mine" : "/requests/inbox") + (qs ? `?${qs}` : ""));
}
