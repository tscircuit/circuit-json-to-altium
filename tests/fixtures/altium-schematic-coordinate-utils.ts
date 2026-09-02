import type { AltiumPoint, AltiumRecord } from "altiumts"
import { ALTIUM_FONT_POINTS_PER_CIRCUIT_UNIT } from "../../lib/create-altium-schematic-font-table"

export const ALTIUM_UNITS_PER_CIRCUIT_UNIT = 20

export type CircuitPoint = {
  x: number
  y: number
}

export function getSchematicCoordinate({
  fallback = 0,
  key,
  record,
}: {
  fallback?: number
  key: string
  record: AltiumRecord
}): number {
  const integer = Number(record.getCaseInsensitive(key) ?? fallback)
  const fraction = record.getCaseInsensitive(`${key}_FRAC`)
  if (!Number.isFinite(integer) || fraction === undefined) {
    return Number.isFinite(integer) ? integer : fallback
  }
  const fractionValue = Number(`0.${fraction.replace(/^[+-]/u, "")}`)
  if (!Number.isFinite(fractionValue)) return integer
  return integer < 0 ? integer - fractionValue : integer + fractionValue
}

export function toCircuitPoint(point: AltiumPoint): CircuitPoint {
  return {
    x: point.x / ALTIUM_UNITS_PER_CIRCUIT_UNIT,
    y: point.y / ALTIUM_UNITS_PER_CIRCUIT_UNIT,
  }
}

export function toCircuitLength(altiumLength: number): number {
  return altiumLength / ALTIUM_UNITS_PER_CIRCUIT_UNIT
}

export function toCircuitFontSize(fontSizePoints: number): number {
  return fontSizePoints / ALTIUM_FONT_POINTS_PER_CIRCUIT_UNIT
}

export function getRecordLocation(record: AltiumRecord): AltiumPoint {
  return {
    x: getSchematicCoordinate({ key: "LOCATION.X", record }),
    y: getSchematicCoordinate({ key: "LOCATION.Y", record }),
  }
}

export function getRecordCorner(record: AltiumRecord): AltiumPoint {
  return {
    x: getSchematicCoordinate({ key: "CORNER.X", record }),
    y: getSchematicCoordinate({ key: "CORNER.Y", record }),
  }
}
