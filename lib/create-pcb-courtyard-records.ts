import {
  pcb_courtyard_circle,
  pcb_courtyard_outline,
  pcb_courtyard_pill,
  pcb_courtyard_polygon,
  pcb_courtyard_rect,
} from "circuit-json"
import {
  createAltiumTrackRecords,
  createCirclePoints,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import type {
  CircuitElement,
  PcbComponentId,
  Point,
  PointTransform,
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
  const courtyards = circuitJson.flatMap((element) => {
    const courtyard = getCourtyardGeometry(element)
    return courtyard ? [courtyard] : []
  })

  courtyards.sort(
    (a, b) => getCourtyardZIndex(a.layer) - getCourtyardZIndex(b.layer),
  )

  for (const courtyard of courtyards) {
    const altiumComponentIndex = componentIndex.get(courtyard.pcbComponentId)
    if (altiumComponentIndex === undefined) {
      throw new Error(
        `PCB courtyard references missing component ${courtyard.pcbComponentId}`,
      )
    }
    records.push(
      ...createAltiumTrackRecords({
        altiumComponentIndex,
        circuitPoints: courtyard.points,
        circuitToAltiumPcbPoint,
        closePath: true,
        layer: getAltiumCourtyardLayer(courtyard.layer),
        strokeWidthMm: COURTYARD_STROKE_WIDTH_MM,
      }),
    )
  }

  return records
}

type CourtyardGeometry = {
  layer: string
  pcbComponentId: PcbComponentId
  points: Point[]
}

function getCourtyardGeometry(
  element: CircuitElement,
): CourtyardGeometry | undefined {
  if (element.type === "pcb_courtyard_outline") {
    const courtyard = pcb_courtyard_outline.parse(element)
    return {
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: courtyard.outline,
    }
  }
  if (element.type === "pcb_courtyard_polygon") {
    const courtyard = pcb_courtyard_polygon.parse(element)
    return {
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: courtyard.points,
    }
  }
  if (element.type === "pcb_courtyard_rect") {
    const courtyard = pcb_courtyard_rect.parse(element)
    return {
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
      layer: courtyard.layer,
      pcbComponentId: courtyard.pcb_component_id,
      points: createCirclePoints({
        center: courtyard.center,
        radiusMm: courtyard.radius,
      }),
    }
  }
  if (element.type === "pcb_courtyard_pill") {
    const courtyard = pcb_courtyard_pill.parse(element)
    return {
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

function getCourtyardZIndex(circuitLayer: string): number {
  return circuitLayer.toLowerCase() === "bottom" ? 0 : 1
}

function getAltiumCourtyardLayer(circuitLayer: string): string {
  return circuitLayer.toLowerCase() === "bottom"
    ? "MECHANICAL16"
    : "MECHANICAL15"
}
