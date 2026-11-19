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

export function StatusBadge({ r }: { r: Req }) {
  const tone = ({ pending: "amber", approved: "green", rejected: "red", cancelled: "gray" } as const)[r.status];
  return (
    <span title={r.decidedAt ? `${fmtDateTime(r.decidedAt)}${r.decisionNote ? ` · ${r.decisionNote}` : ""}` : undefined}>
      <Badge tone={tone}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
    </span>
  );
}
