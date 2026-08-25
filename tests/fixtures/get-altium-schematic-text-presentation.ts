import type { AltiumRecord, AltiumSchDoc } from "altiumts"
import {
  type CircuitPoint,
  getRecordLocation,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"
import { getAltiumSchematicFont } from "./get-altium-schematic-text-frame-lines"
import { getCssColorFromAltiumRecord } from "./get-css-color-from-altium-record"

type SchematicTextAnchor =
  | "bottom_center"
  | "bottom_left"
  | "bottom_right"
  | "center"
  | "center_left"
  | "center_right"
  | "top_center"
  | "top_left"
  | "top_right"

type GetAltiumSchematicTextPresentationInput = {
  document: AltiumSchDoc
  fallbackFontSizePoints: number
  record: AltiumRecord
}

export type AltiumSchematicTextPresentation = {
  anchor: SchematicTextAnchor
  color: string
  font_size: number
  position: CircuitPoint
  rotation: number
}

const SCHEMATIC_TEXT_ANCHORS: SchematicTextAnchor[][] = [
  ["bottom_left", "bottom_center", "bottom_right"],
  ["center_left", "center", "center_right"],
  ["top_left", "top_center", "top_right"],
]

function getSchematicTextAnchor(record: AltiumRecord): SchematicTextAnchor {
  const justification = Math.min(
    Math.max(Math.round(record.getNumber("JUSTIFICATION") ?? 0), 0),
    8,
  )
  const orientation =
    ((Math.round(record.getNumber("ORIENTATION") ?? 0) % 4) + 4) % 4
  const rowIndex = Math.floor(justification / 3)
  const originalColumnIndex = justification % 3
  const columnIndex =
    orientation === 2 || orientation === 3
      ? 2 - originalColumnIndex
      : originalColumnIndex
  return SCHEMATIC_TEXT_ANCHORS[rowIndex]?.[columnIndex] ?? "bottom_left"
}

function getSchematicTextRotationDegrees(record: AltiumRecord): number {
  const orientation =
    ((Math.round(record.getNumber("ORIENTATION") ?? 0) % 4) + 4) % 4
  return orientation === 1 || orientation === 3 ? -90 : 0
}

export function getAltiumSchematicTextPresentation({
  document,
  fallbackFontSizePoints,
  record,
}: GetAltiumSchematicTextPresentationInput): AltiumSchematicTextPresentation {
  const font = getAltiumSchematicFont({
    document,
    fallbackSizePoints: fallbackFontSizePoints,
    record,
  })
  return {
    anchor: getSchematicTextAnchor(record),
    color: getCssColorFromAltiumRecord({
      fallbackCssColor: "#1f2937",
      fieldNames: ["COLOR"],
      record,
    }),
    font_size: toCircuitLength(font.sizePoints),
    position: toCircuitPoint(getRecordLocation(record)),
    rotation: getSchematicTextRotationDegrees(record),
  }
}
