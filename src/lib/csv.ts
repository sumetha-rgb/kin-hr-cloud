/** CSV พร้อม BOM ให้ Excel เปิดภาษาไทยได้ถูกต้อง */
export function csvResponse(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // กันสูตร Excel (CSV injection)
    const safe = /^[=+\-@]/.test(s) && isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const body = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
