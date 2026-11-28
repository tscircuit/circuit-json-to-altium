import { pcb_silkscreen_oval } from "circuit-json"
import {
  createAltiumRegionRecord,
  createAltiumTrackRecords,
  createEllipsePoints,
} from "./create-pcb-annotation-primitives"
import { asPositiveNumber, asString, byType } from "./format"
import type { CircuitElement, PcbComponentId, PointTransform } from "./types"

const DEFAULT_SILKSCREEN_OVAL_STROKE_WIDTH_MM = 0.1

export function createPcbSilkscreenOvalRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}): string[] {
  return byType(circuitJson, "pcb_silkscreen_oval").flatMap((element) => {
    const oval = pcb_silkscreen_oval.parse({
      ...element,
      pcb_component_id: asString(element.pcb_component_id),
    })
    if (oval.radius_x <= 0 || oval.radius_y <= 0) return []
    const owner = componentIndex.get(oval.pcb_component_id)
    const layer = oval.layer === "bottom" ? "BOTTOMOVERLAY" : "TOPOVERLAY"
    const strokeWidthMm =
      element.stroke_width === 0
        ? 0
        : asPositiveNumber(
            element.stroke_width,
            DEFAULT_SILKSCREEN_OVAL_STROKE_WIDTH_MM,
          )
    const circuitPoints = createEllipsePoints({
      center: oval.center,
      radiusXMm: oval.radius_x,
      radiusYMm: oval.radius_y,
      rotationDegrees: oval.ccw_rotation ?? 0,
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
