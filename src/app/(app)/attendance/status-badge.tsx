import { Badge } from "@/components/ui";
import { DAY_STATUS_LABEL, type DayRecord } from "@/lib/attendance";

export function DayStatusBadge({ d }: { d: DayRecord }) {
  const tone = (
    {
      present: "green",
      late: "amber",
      incomplete: "amber",
      absent: "red",
      leave: "blue",
      holiday: "blue",
      off: "gray",
      future: "gray",
      not_employed: "gray",
    } as const
  )[d.status];
  const label = d.status === "leave" && d.leave ? d.leave.name + (d.leave.portion < 1 ? " (ครึ่งวัน)" : "") : d.status === "holiday" ? d.holiday : DAY_STATUS_LABEL[d.status];
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={tone}>{label}</Badge>
      {d.status !== "leave" && d.leave && <Badge tone="blue">{d.leave.name} ½</Badge>}
      {d.lateMinutes > 0 && d.status !== "late" && <Badge tone="amber">สาย {d.lateMinutes}น.</Badge>}
    </span>
  );
}
