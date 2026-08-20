import {
  pcb_courtyard_circle,
  pcb_courtyard_outline,
  pcb_courtyard_pill,
  pcb_courtyard_polygon,
  pcb_courtyard_rect,
} from "circuit-json"
import {
  createAltiumPcbPathRecords,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import { createPcbFullCircleArcRecord } from "./create-pcb-arc-record"
import { getCircuitPathPoints } from "./get-circuit-path-points"
import type {
  CircuitElement,
  PcbComponentId,
  Point,
  PointTransform,
  PointWithBulge,
} from "./types"

const COURTYARD_STROKE_WIDTH_MM = 0.05

type CreatePcbCourtyardRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}

export function createPcbCourtyardRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbCourtyardRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    const courtyard = getCourtyardGeometry(element)
    if (!courtyard) continue
    const altiumComponentIndex = componentIndex.get(courtyard.pcbComponentId)
    if (altiumComponentIndex === undefined) {
      throw new Error(
        `PCB courtyard references missing component ${courtyard.pcbComponentId}`,
      )
    }
    const layer = getAltiumCourtyardLayer(courtyard.layer)
    records.push(
      ...(courtyard.kind === "circle"
        ? [
            createPcbFullCircleArcRecord({
              altiumComponentIndex,
              center: courtyard.center,
              circuitToAltiumPcbPoint,
              layer,
              radiusMm: courtyard.radiusMm,
              widthMm: COURTYARD_STROKE_WIDTH_MM,
            }),
          ]
        : createAltiumPcbPathRecords({
            altiumComponentIndex,
            circuitPoints: courtyard.points,
            circuitToAltiumPcbPoint,
            closePath: true,
            layer,
            strokeWidthMm: COURTYARD_STROKE_WIDTH_MM,
          })),
    )
  }

  return records
}

type CourtyardGeometry =
  | {
      center: Point
      kind: "circle"
      layer: string
      pcbComponentId: PcbComponentId
      radiusMm: number
    }
  | {
      kind: "path"
      layer: string
      pcbComponentId: PcbComponentId
      points: PointWithBulge[]
    }

function getCourtyardGeometry(
  element: CircuitElement,
): CourtyardGeometry | undefined {
  if (element.type === "pcb_courtyard_outline") {
    const courtyard = pcb_courtyard_outline.parse(element)
    return {
      kind: "path",
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: getCircuitPathPoints(element.outline),
    }
  }
  if (element.type === "pcb_courtyard_polygon") {
    const courtyard = pcb_courtyard_polygon.parse(element)
    return {
      kind: "path",
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: courtyard.points,
    }
  }
  if (element.type === "pcb_courtyard_rect") {
    const courtyard = pcb_courtyard_rect.parse(element)
    return {
      kind: "path",
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: createRoundedRectPoints({
        center: courtyard.center,
        cornerRadiusMm: 0,
        heightMm: courtyard.height,
        rotationDegrees: courtyard.ccw_rotation,
        widthMm: courtyard.width,
      }),
    }
  }
  if (element.type === "pcb_courtyard_circle") {
    const courtyard = pcb_courtyard_circle.parse(element)
    return {
      center: courtyard.center,
      kind: "circle",
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      radiusMm: courtyard.radius,
    }
  }
  if (element.type === "pcb_courtyard_pill") {
    const courtyard = pcb_courtyard_pill.parse(element)
    return {
      kind: "path",
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: createRoundedRectPoints({
        center: courtyard.center,
        cornerRadiusMm: courtyard.radius,
        heightMm: courtyard.height,
        widthMm: courtyard.width,
      }),
    }
  }
  return undefined
}

function getAltiumCourtyardLayer(circuitLayer: string): string {
  return circuitLayer.toLowerCase() === "bottom"
    ? "MECHANICAL16"
    : "MECHANICAL15"
}
