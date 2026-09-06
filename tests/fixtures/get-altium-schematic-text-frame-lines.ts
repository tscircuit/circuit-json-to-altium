import type { AltiumPoint, AltiumRecord, AltiumSchDoc } from "altiumts"
import {
  getRecordCorner,
  getRecordLocation,
} from "./altium-schematic-coordinate-utils"

export type SchematicTextAnchor =
  | "bottom_center"
  | "bottom_left"
  | "bottom_right"
  | "center"
  | "center_left"
  | "center_right"
  | "top_center"
  | "top_left"
  | "top_right"

export type AltiumSchematicFont = {
  family: string
  sizePoints: number
  style: "italic" | "normal"
  weight: "bold" | "normal"
}

export type AltiumSchematicTextFrameLine = {
  anchor: SchematicTextAnchor
  fontFamily: string
  fontSizePoints: number
  fontStyle: "italic" | "normal"
  fontWeight: "bold" | "normal"
  position: AltiumPoint
  text: string
}

export function getAltiumSchematicFont({
  document,
  fallbackSizePoints,
  record,
}: {
  document: AltiumSchDoc
  fallbackSizePoints: number
  record: AltiumRecord
}): AltiumSchematicFont {
  const fontId = Math.max(Math.round(record.getNumber("FONTID") ?? 1), 1)
  const sheetRecord = document.getRecordsByKind("31")[0]
  return {
    family: sheetRecord?.getDecoded(`FONTNAME${fontId}`) ?? "Arial",
    sizePoints: Math.max(
      sheetRecord?.getNumber(`SIZE${fontId}`) ?? fallbackSizePoints,
      1,
    ),
    style:
      sheetRecord?.getBoolean(`ITALIC${fontId}`) === true ? "italic" : "normal",
    weight:
      sheetRecord?.getBoolean(`BOLD${fontId}`) === true ? "bold" : "normal",
  }
}

function estimateSchematicTextWidthAltiumUnits({
  fontFamily,
  fontSizePoints,
  text,
}: {
  fontFamily: string
  fontSizePoints: number
  text: string
}): number {
  if (/courier|mono/iu.test(fontFamily)) {
    return text.length * fontSizePoints * 0.6
  }
  if (!/times|cambria|serif/iu.test(fontFamily)) {
    return text.length * fontSizePoints * 0.52
  }

  return [...text].reduce((width, character) => {
    const emWidth =
      character === " "
        ? 0.23
        : /[ilI1.,:;!'`|]/u.test(character)
          ? 0.2
          : /[mwMW@%]/u.test(character)
            ? 0.7
            : /[A-Z0-9]/u.test(character)
              ? 0.5
              : 0.4
    return width + emWidth * fontSizePoints
  }, 0)
}

function wrapSchematicText({
  fontFamily,
  fontSizePoints,
  maximumWidthAltiumUnits,
  text,
}: {
  fontFamily: string
  fontSizePoints: number
  maximumWidthAltiumUnits: number
  text: string
}): string[] {
  return text.split("\n").flatMap((paragraph) => {
    if (
      estimateSchematicTextWidthAltiumUnits({
        fontFamily,
        fontSizePoints,
        text: paragraph,
      }) <= maximumWidthAltiumUnits
    ) {
      return [paragraph]
    }
    const lines: string[] = []
    let currentLine = ""
    for (const word of paragraph.split(/\s+/u)) {
      const candidateLine = currentLine ? `${currentLine} ${word}` : word
      if (
        !currentLine ||
        estimateSchematicTextWidthAltiumUnits({
          fontFamily,
          fontSizePoints,
          text: candidateLine,
        }) <= maximumWidthAltiumUnits
      ) {
        currentLine = candidateLine
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines.length > 0 ? lines : [paragraph]
  })
}

export function getAltiumSchematicTextFrameLines({
  document,
  record,
}: {
  document: AltiumSchDoc
  record: AltiumRecord
}): AltiumSchematicTextFrameLine[] {
  const location = getRecordLocation(record)
  const corner = getRecordCorner(record)
  const minX = Math.min(location.x, corner.x)
  const maxX = Math.max(location.x, corner.x)
  const minY = Math.min(location.y, corner.y)
  const maxY = Math.max(location.y, corner.y)
  const font = getAltiumSchematicFont({
    document,
    fallbackSizePoints: 9,
    record,
  })
  const textMarginAltiumUnits = Math.max(record.getNumber("TEXTMARGIN") ?? 0, 0)
  const availableWidthAltiumUnits = Math.max(
    maxX - minX - textMarginAltiumUnits * 2,
    font.sizePoints,
  )
  const availableHeightAltiumUnits = Math.max(
    maxY - minY - textMarginAltiumUnits * 2,
    font.sizePoints,
  )
  const decodedText = (record.getDecoded("TEXT") ?? "")
    .replaceAll("~1", "\n")
    .replaceAll("\\n", "\n")
  const lines =
    record.getBoolean("WORDWRAP") === false
      ? decodedText.split("\n")
      : wrapSchematicText({
          fontFamily: font.family,
          fontSizePoints: font.sizePoints,
          maximumWidthAltiumUnits: availableWidthAltiumUnits,
          text: decodedText,
        })
  const visibleLines =
    record.getBoolean("CLIPTORECT") === false
      ? lines
      : lines.slice(
          0,
          Math.max(Math.ceil(availableHeightAltiumUnits / font.sizePoints), 1),
        )
  const alignment = Math.round(record.getNumber("ALIGNMENT") ?? 1)
  const anchor: SchematicTextAnchor =
    alignment === 2 ? "top_center" : alignment === 3 ? "top_right" : "top_left"
  const textX =
    alignment === 2
      ? (minX + maxX) / 2
      : alignment === 3
        ? maxX - textMarginAltiumUnits
        : minX + textMarginAltiumUnits

  return visibleLines.flatMap((text, lineIndex) =>
    text
      ? [
          {
            anchor,
            fontFamily: font.family,
            fontSizePoints: font.sizePoints,
            fontStyle: font.style,
            fontWeight: font.weight,
            position: {
              x: textX,
              y: maxY - textMarginAltiumUnits - lineIndex * font.sizePoints,
            },
            text,
          },
        ]
      : [],
  )
}
