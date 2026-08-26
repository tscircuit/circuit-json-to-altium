import { pcb_cutout } from "circuit-json"
import { createPathCutoutContours } from "./create-path-cutout-contours"
import {
  createAltiumRegionRecord,
  createCirclePoints,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import type { CircuitElement, Point, PointTransform } from "./types"

type CreatePcbCutoutRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
}

export function createPcbCutoutRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
}: CreatePcbCutoutRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_cutout") continue
    const cutoutResult = pcb_cutout.safeParse(element)
    if (!cutoutResult.success) {
      throw new Error(
        `Unsupported PCB cutout shape: ${(element as { shape?: string }).shape ?? "unknown"}`,
      )
    }
    const cutout = cutoutResult.data
    let circuitContours: Point[][]

    if (cutout.shape === "rect") {
      circuitContours = [
        createRoundedRectPoints({
          center: cutout.center,
          cornerRadiusMm: cutout.corner_radius ?? 0,
          heightMm: cutout.height,
          rotationDegrees: cutout.rotation ?? 0,
          widthMm: cutout.width,
        }),
      ]
    } else if (cutout.shape === "circle") {
      circuitContours = [
        createCirclePoints({
          center: cutout.center,
          radiusMm: cutout.radius,
        }),
      ]
    } else if (cutout.shape === "polygon") {
      circuitContours = [cutout.points]
    } else if (cutout.shape === "path") {
      circuitContours = createPathCutoutContours({
        route: cutout.route,
        slotWidthMm: cutout.slot_width,
        slotLengthMm: cutout.slot_length,
        spaceBetweenSlotsMm: cutout.space_between_slots,
        slotCornerRadiusMm: cutout.slot_corner_radius,
      })
    } else {
      throw new Error(
        `Unsupported PCB cutout shape: ${(cutout as { shape: string }).shape}`,
      )
    }

    records.push(
      ...circuitContours.map((circuitPoints) =>
        createAltiumRegionRecord({
          circuitPoints,
          circuitToAltiumPcbPoint,
          isKeepout: false,
          layer: "MULTILAYER",
          regionKind: "BOARDCUTOUT",
        }),
      ),
    )
  }

  return records
}
