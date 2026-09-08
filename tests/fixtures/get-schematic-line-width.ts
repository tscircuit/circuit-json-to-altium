import type { AltiumRecord } from "altiumts"

/** Native TSize: hairline, 10 mil, 30 mil, 50 mil (one unit is 10 mil). */
export function getSchematicLineWidth(record: AltiumRecord): number {
  return [0, 1, 3, 5][record.getNumber("LINEWIDTH") ?? 0] ?? 0
}
