import { convertCircuitPcbCcwRotationDegreesToAltium } from "./convert-circuit-pcb-ccw-rotation-degrees-to-altium"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  formatMil,
  formatNumber,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
} from "./format"
import type { CircuitElement, Point, PointTransform } from "./types"

type CreatePcbTextRecordOptions = {
  altiumComponentIndex?: number
  circuitText: CircuitElement
  circuitToAltiumPcbPoint: PointTransform
  layer: string
}

export function createPcbTextRecord({
  altiumComponentIndex,
  circuitText,
  circuitToAltiumPcbPoint,
  layer,
}: CreatePcbTextRecordOptions): string {
  const circuitAnchor =
    asPoint(circuitText.anchor_position) ??
    asPoint(circuitText.center) ??
    ({ x: 0, y: 0 } satisfies Point)
  const altiumPosition = circuitToAltiumPcbPoint(circuitAnchor)
  const isBottomLayer = asString(circuitText.layer).toLowerCase() === "bottom"
  const explicitMirroring =
    typeof circuitText.is_mirrored === "boolean"
      ? circuitText.is_mirrored
      : circuitText.is_mirrored_from_top_view
  const isMirrored =
    typeof explicitMirroring === "boolean" ? explicitMirroring : isBottomLayer
  const fontSizeMm = asPositiveNumber(circuitText.font_size, 1)

  const knockoutFields: string[] = []
  if (circuitText.is_knockout === true) {
    const padding = isCircuitElement(circuitText.knockout_padding)
      ? circuitText.knockout_padding
      : undefined
    const margins = ["left", "right", "top", "bottom"].map((side) =>
      asNumber(padding?.[side], fontSizeMm * 0.3),
    )
    const margin = margins[0]!
    if (
      margin < 0 ||
      margins.some((value) => Math.abs(value - margin) > 1e-9)
    ) {
      throw new Error(
        "Native Altium knockout text requires equal, non-negative padding on all sides",
      )
    }
    knockoutFields.push(
      "INVERTED=TRUE",
      "INVERTEDRECT=FALSE",
      `MARGINBORDERWIDTH=${formatMil(margin * MILLIMETERS_TO_MILS)}`,
    )
  }

  return [
    "|RECORD=Text",
    ...(altiumComponentIndex === undefined
      ? []
      : [`COMPONENT=${altiumComponentIndex}`]),
    `LAYER=${layer}`,
    `X=${formatMil(altiumPosition.x)}`,
    `Y=${formatMil(altiumPosition.y)}`,
    `ROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(asNumber(circuitText.ccw_rotation)))}`,
    `MIRROR=${isMirrored ? "TRUE" : "FALSE"}`,
    `HEIGHT=${formatMil(fontSizeMm * MILLIMETERS_TO_MILS)}`,
    `WIDTH=${formatMil(Math.max(0.05, fontSizeMm * 0.1) * MILLIMETERS_TO_MILS)}`,
    "USETTFONTS=TRUE",
    "FONTNAME=Arial",
    ...knockoutFields,
    `JUSTIFICATION=${getAltiumTextJustification(circuitText.anchor_alignment)}`,
    `WIDESTRING=${encodeAltiumWideString(asString(circuitText.text))}`,
  ].join("|")
}

function getAltiumTextJustification(anchorAlignment: unknown): number {
  switch (anchorAlignment) {
    case "top_left":
      return 1
    case "center_left":
      return 2
    case "bottom_left":
      return 3
    case "top_center":
      return 4
    case "center":
      return 5
    case "bottom_center":
      return 6
    case "top_right":
      return 7
    case "center_right":
      return 8
    case "bottom_right":
      return 9
    default:
      return 5
  }
}

function encodeAltiumWideString(text: string): string {
  const codePoints: number[] = []
  for (const character of text) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined) codePoints.push(codePoint)
  }
  return codePoints.join(",")
}
