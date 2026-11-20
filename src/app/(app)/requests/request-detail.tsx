import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";
import type { requests } from "@/db/schema";
import { bkkTimeStr, fmtDate, fmtDateTime } from "@/lib/time";
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/util";

type Req = typeof requests.$inferSelect;

export function RequestSummary({ r, leaveName }: { r: Req; leaveName?: string | null }) {
  if (r.type === "leave")
    return (
      <span>
        {leaveName} · {fmtDate(r.startDate)}
        {r.endDate !== r.startDate && ` – ${fmtDate(r.endDate)}`} <span className="text-stone-500">({Number(r.days)} วัน)</span>
      </span>
    );
  if (r.type === "ot")
    return (
      <span>
        {fmtDate(r.otDate)} · {Number(r.otHours)} ชม. × {Number(r.otRate)} เท่า
      </span>
    );
  return (
    <span>
      {r.correctionType === "in" ? "เวลาเข้า" : "เวลาออก"} {r.correctionAt && `${fmtDate(r.correctionAt)} ${bkkTimeStr(r.correctionAt)} น.`}
    </span>
  );
}

export function TypeBadge({ type }: { type: Req["type"] }) {
  return <Badge tone={type === "leave" ? "blue" : type === "ot" ? "amber" : "gray"}>{REQUEST_TYPE_LABEL[type]}</Badge>;
}

/** stage (ถ้าส่งมา) บอกว่าคำขอที่รออยู่ ค้างที่หัวหน้าหรือ HR */
export function StatusBadge({ r, stage }: { r: Req; stage?: "head" | "hr" | "done" }) {
  const tone = (
    {
      pending: "amber",
      approved: "green",
      rejected: "red",
      cancelled: "gray",
    } as const
  )[r.status];
  let label: string = REQUEST_STATUS_LABEL[r.status];
  let t: "amber" | "green" | "red" | "gray" | "blue" = tone;
  if (r.status === "pending") {
    if (r.headApprovedAt) [label, t] = ["หัวหน้าอนุมัติแล้ว · รอ HR", "blue"];
    else if (stage === "head") label = "รอหัวหน้าอนุมัติ";
    else if (stage === "hr") label = "รอ HR อนุมัติ";
  }
  return (
    <span title={r.decidedAt ? `${fmtDateTime(r.decidedAt)}${r.decisionNote ? ` · ${r.decisionNote}` : ""}` : undefined}>
      <Badge tone={t}>{label}</Badge>
    </span>
  );
}

type Step = { state: "done" | "wait" | "no" | "next"; text: string };

/**
 * เส้นทางอนุมัติแบบย่อ: ใครอนุมัติแล้ว / ตอนนี้รอใคร
 * headName = หัวหน้าที่ต้องอนุมัติ ณ ตอนนี้ (null = ไม่มี ส่งตรง HR)
 */
export function ApprovalTrail({ r, headName, userName }: { r: Req; headName: string | null; userName: Map<number, string> }) {
  if (r.status === "cancelled") return null;
  const who = (id: number | null) => (id ? (userName.get(id) ?? "-") : "-");
  const headActed = !!r.headApprovedAt;
  const headFinal = headActed && r.status !== "pending" && r.decidedBy === r.headApprovedBy;
  const steps: Step[] = [];

  if (r.status === "pending") {
    if (headActed) {
      steps.push({
        state: "done",
        text: `หัวหน้า ${who(r.headApprovedBy)} อนุมัติแล้ว`,
      });
      steps.push({ state: "wait", text: "รอ HR อนุมัติ" });
    } else if (headName) {
      steps.push({ state: "wait", text: `รอหัวหน้า ${headName}` });
      steps.push({
        state: "next",
        text: r.type === "ot" ? "แจ้ง HR ให้ทราบ" : "จากนั้น HR",
      });
    } else {
      steps.push({ state: "wait", text: "รอ HR อนุมัติ" });
    }
  } else if (r.status === "approved") {
    if (headFinal)
      steps.push({
        state: "done",
        text: `หัวหน้า ${who(r.headApprovedBy)} อนุมัติ`,
      });
    else {
      if (headActed) steps.push({ state: "done", text: `หัวหน้า ${who(r.headApprovedBy)}` });
      steps.push({ state: "done", text: `HR ${who(r.decidedBy)} อนุมัติ` });
    }
  } else if (r.status === "rejected") {
    if (headFinal) steps.push({ state: "no", text: `หัวหน้า ${who(r.decidedBy)} ไม่อนุมัติ` });
    else {
      if (headActed) steps.push({ state: "done", text: `หัวหน้า ${who(r.headApprovedBy)}` });
      steps.push({ state: "no", text: `HR ${who(r.decidedBy)} ไม่อนุมัติ` });
    }
  }

  const icon = {
    done: "checkCircle",
    wait: "clock",
    no: "x",
    next: "",
  } as const;
  const color = {
    done: "text-emerald-700",
    wait: "text-amber-700 font-medium",
    no: "text-red-700",
    next: "text-stone-400",
  } as const;
  return (
    <ol className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
      {steps.map((s, i) => (
        <li key={i} className={`flex items-center gap-1 ${color[s.state]}`}>
          {i > 0 && <Icon name="chevronRight" className="size-3 text-stone-300" />}
          {icon[s.state] && <Icon name={icon[s.state]} className="size-3.5 shrink-0" />}
          {s.text}
        </li>
      ))}
    </ol>
  );
}
