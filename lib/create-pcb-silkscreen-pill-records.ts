import { pcb_silkscreen_pill } from "circuit-json"
import {
  createAltiumRegionRecord,
  createAltiumTrackRecords,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import { asPositiveNumber, asString, byType } from "./format"
import type { CircuitElement, PcbComponentId, PointTransform } from "./types"

const DEFAULT_SILKSCREEN_PILL_STROKE_WIDTH_MM = 0.1

export function createPcbSilkscreenPillRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}): string[] {
  return byType(circuitJson, "pcb_silkscreen_pill").flatMap((element) => {
    const pill = pcb_silkscreen_pill.parse({
      ...element,
      pcb_component_id: asString(element.pcb_component_id),
    })
    if (pill.width <= 0 || pill.height <= 0) return []
    const owner = componentIndex.get(pill.pcb_component_id)
    const layer = pill.layer === "bottom" ? "BOTTOMOVERLAY" : "TOPOVERLAY"
    const strokeWidthMm =
      element.stroke_width === 0
        ? 0
        : asPositiveNumber(
            element.stroke_width,
            DEFAULT_SILKSCREEN_PILL_STROKE_WIDTH_MM,
          )
    const circuitPoints = createRoundedRectPoints({
      center: pill.center,
      cornerRadiusMm: Math.min(pill.width, pill.height) / 2,
      heightMm: pill.height,
      rotationDegrees: pill.ccw_rotation ?? 0,
      widthMm: pill.width,
    })
    const records: string[] = []
    if (element.is_filled === true) {
      records.push(
        createAltiumRegionRecord({
          altiumComponentIndex: owner,
          circuitPoints,
          circuitToAltiumPcbPoint,
          layer,
        }),
      )
    }
    if (element.has_stroke !== false && strokeWidthMm > 0) {
      records.push(
        ...createAltiumTrackRecords({
          altiumComponentIndex: owner,
          circuitPoints,
          circuitToAltiumPcbPoint,
          closePath: true,
          layer,
          strokeWidthMm,
        }),
      )
    }
    return records
  })
}
