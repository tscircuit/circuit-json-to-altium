import {
  type AltiumRecord,
  type AltiumSchDoc,
  getSchematicRecordPoints,
  resolveSchematicParameterReference,
} from "altiumts"
import type { CircuitElement } from "../../lib/types"
import {
  getRecordCorner,
  getRecordLocation,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"
import { getAltiumSchematicTextFrameLines } from "./get-altium-schematic-text-frame-lines"
import { getAltiumSchematicTextPresentation } from "./get-altium-schematic-text-presentation"
import { getCssColorFromAltiumRecord } from "./get-css-color-from-altium-record"

const ANNOTATION_RECORD_KINDS = new Set(["4", "6", "7", "10", "14", "28"])

function appendLabelAnnotation({
  annotationIndex,
  document,
  elements,
  record,
}: {
  annotationIndex: number
  document: AltiumSchDoc
  elements: CircuitElement[]
  record: AltiumRecord
}): void {
  const sourceText = record.getDecoded("TEXT") ?? ""
  if (!sourceText || record.getBoolean("ISHIDDEN") === true) return
  const text =
    resolveSchematicParameterReference(document, sourceText) ?? sourceText
  elements.push({
    type: "schematic_text",
    schematic_text_id: `schematic_text_label_${annotationIndex}`,
    text,
    ...getAltiumSchematicTextPresentation({
      document,
      fallbackFontSizePoints: 9,
      record,
    }),
  })
}

function appendPathAnnotation({
  annotationIndex,
  elements,
  record,
}: {
  annotationIndex: number
  elements: CircuitElement[]
  record: AltiumRecord
}): void {
  const points = getSchematicRecordPoints(record).map(toCircuitPoint)
  if (points.length < 2) return
  const isFilled = record.recordKind === "7"
  elements.push({
    type: "schematic_path",
    schematic_path_id: `schematic_path_${annotationIndex}`,
    points,
    stroke_width: toCircuitLength(record.getNumber("LINEWIDTH") ?? 1),
    stroke_color: getCssColorFromAltiumRecord({
      fallbackCssColor: "#1f2937",
      fieldNames: ["COLOR"],
      record,
    }),
    is_filled: isFilled,
    ...(isFilled
      ? {
          fill_color: getCssColorFromAltiumRecord({
            fallbackCssColor: "#ffffff",
            fieldNames: ["AREACOLOR"],
            record,
          }),
        }
      : {}),
    is_dashed: false,
  })
}

function appendRectAnnotation({
  annotationIndex,
  elements,
  record,
}: {
  annotationIndex: number
  elements: CircuitElement[]
  record: AltiumRecord
}): void {
  const location = getRecordLocation(record)
  const corner = getRecordCorner(record)
  const isFilled = record.getBoolean("ISSOLID") === true
  elements.push({
    type: "schematic_rect",
    schematic_rect_id: `schematic_rect_${annotationIndex}`,
    center: toCircuitPoint({
      x: (location.x + corner.x) / 2,
      y: (location.y + corner.y) / 2,
    }),
    width: toCircuitLength(Math.abs(corner.x - location.x)),
    height: toCircuitLength(Math.abs(corner.y - location.y)),
    rotation: 0,
    stroke_width: toCircuitLength(record.getNumber("LINEWIDTH") ?? 1),
    color: getCssColorFromAltiumRecord({
      fallbackCssColor: "#1f2937",
      fieldNames: ["COLOR"],
      record,
    }),
    is_filled: isFilled,
    ...(isFilled
      ? {
          fill_color: getCssColorFromAltiumRecord({
            fallbackCssColor: "#ffffff",
            fieldNames: ["AREACOLOR"],
            record,
          }),
        }
      : {}),
    is_dashed: false,
  })
}

function appendTextFrameAnnotations({
  annotationIndex,
  document,
  elements,
  record,
}: {
  annotationIndex: number
  document: AltiumSchDoc
  elements: CircuitElement[]
  record: AltiumRecord
}): void {
  const location = getRecordLocation(record)
  const corner = getRecordCorner(record)
  const minX = Math.min(location.x, corner.x)
  const maxX = Math.max(location.x, corner.x)
  const minY = Math.min(location.y, corner.y)
  const maxY = Math.max(location.y, corner.y)
  const isFilled = record.getBoolean("ISSOLID") === true
  const showsBorder = record.getBoolean("SHOWBORDER") === true
  if (isFilled || showsBorder) {
    const fillColor = getCssColorFromAltiumRecord({
      fallbackCssColor: "#ffffff",
      fieldNames: ["AREACOLOR"],
      record,
    })
    elements.push({
      type: "schematic_rect",
      schematic_rect_id: `schematic_rect_text_frame_${annotationIndex}`,
      center: toCircuitPoint({
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      }),
      width: toCircuitLength(maxX - minX),
      height: toCircuitLength(maxY - minY),
      rotation: 0,
      stroke_width: toCircuitLength(1),
      color: showsBorder
        ? getCssColorFromAltiumRecord({
            fallbackCssColor: "#1f2937",
            fieldNames: ["COLOR"],
            record,
          })
        : fillColor,
      is_filled: isFilled,
      ...(isFilled ? { fill_color: fillColor } : {}),
      is_dashed: false,
    })
  }

  const color = getCssColorFromAltiumRecord({
    fallbackCssColor: "#1f2937",
    fieldNames: ["TEXTCOLOR", "COLOR"],
    record,
  })
  const lines = getAltiumSchematicTextFrameLines({ document, record })
  for (const [lineIndex, line] of lines.entries()) {
    elements.push({
      type: "schematic_text",
      schematic_text_id: `schematic_text_frame_${annotationIndex}_${lineIndex}`,
      text: line.text,
      font_size: toCircuitLength(line.fontSizePoints),
      position: toCircuitPoint(line.position),
      rotation: 0,
      anchor: line.anchor,
      color,
    })
  }
}

export function appendAltiumSchematicSheetAnnotationElements(
  document: AltiumSchDoc,
  elements: CircuitElement[],
): void {
  for (const [annotationIndex, record] of document.records.entries()) {
    if (
      !ANNOTATION_RECORD_KINDS.has(record.recordKind ?? "") ||
      document.getParent(record) !== undefined
    ) {
      continue
    }
    if (record.recordKind === "4") {
      appendLabelAnnotation({ annotationIndex, document, elements, record })
    } else if (record.recordKind === "6" || record.recordKind === "7") {
      appendPathAnnotation({ annotationIndex, elements, record })
    } else if (record.recordKind === "10" || record.recordKind === "14") {
      appendRectAnnotation({ annotationIndex, elements, record })
    } else if (record.recordKind === "28") {
      appendTextFrameAnnotations({
        annotationIndex,
        document,
        elements,
        record,
      })
    }
  }
}
