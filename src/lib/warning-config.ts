import { asc } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { warningCategories, warningLevelSettings } from "@/db/schema";
import { DEFAULT_CATEGORIES, DEFAULT_LEVELS, WARNING_LEVELS, WARNING_TONE, type WarningLevel } from "./warning";

export type LevelConfig = {
  level: WarningLevel;
  step: number; // ระดับที่ 1-3
  name: string;
  docTitle: string;
  description: string;
  validityMonths: number;
  closingText: string;
  enabled: boolean;
  tone: (typeof WARNING_TONE)[WarningLevel];
};

/** การตั้งค่าใบเตือน — ครั้งแรกจะใส่ค่าเริ่มต้นให้เอง (เพิ่มอย่างเดียว ไม่ทับของเดิม) */
export const getWarningConfig = cache(async () => {
  let [levels, cats] = await Promise.all([db.select().from(warningLevelSettings), db.select().from(warningCategories).orderBy(asc(warningCategories.sortOrder), asc(warningCategories.id))]);
  if (levels.length < WARNING_LEVELS.length) {
    await db
      .insert(warningLevelSettings)
      .values(WARNING_LEVELS.map((level) => ({ level, ...DEFAULT_LEVELS[level] })))
      .onConflictDoNothing();
    levels = await db.select().from(warningLevelSettings);
  }
  if (cats.length === 0) {
    await db
      .insert(warningCategories)
      .values(DEFAULT_CATEGORIES.map((name, i) => ({ name, sortOrder: i })))
      .onConflictDoNothing();
    cats = await db.select().from(warningCategories).orderBy(asc(warningCategories.sortOrder), asc(warningCategories.id));
  }
  const byLevel = new Map(levels.map((l) => [l.level, l]));
  const list: LevelConfig[] = WARNING_LEVELS.map((level, i) => {
    const l = byLevel.get(level)!;
    return {
      level,
      step: i + 1,
      name: l.name,
      docTitle: l.docTitle,
      description: l.description ?? "",
      validityMonths: l.validityMonths,
      closingText: l.closingText ?? "",
      enabled: l.enabled,
      tone: WARNING_TONE[level],
    };
  });
  return {
    levels: list,
    level: Object.fromEntries(list.map((l) => [l.level, l])) as Record<WarningLevel, LevelConfig>,
    categories: cats,
    activeCategories: cats.filter((c) => c.active).map((c) => c.name),
  };
});
