import {
  pcb_fabrication_note_dimension,
  pcb_fabrication_note_path,
  pcb_fabrication_note_rect,
  pcb_fabrication_note_text,
  pcb_note_dimension,
  pcb_note_line,
  pcb_note_path,
  pcb_note_rect,
  pcb_note_text,
} from "circuit-json"
import {
  createAltiumFillRecord,
  createAltiumPcbPathRecords,
  createAltiumRegionRecord,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import { createPcbDimensionRecord } from "./create-pcb-dimension-record"
import { createPcbTextRecord } from "./create-pcb-text-record"
import { getCircuitPathPoints } from "./get-circuit-path-points"
import type {
  CircuitElement,
  PcbComponentId,
  Point,
  PointTransform,
} from "./types"

type CreatePcbDocumentationRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}

export function createPcbDocumentationRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbDocumentationRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    if (!isPcbDocumentationElement(element)) continue
    const altiumComponentIndex = getAltiumComponentIndex({
      componentIndex,
      element,
    })
    if (element.type === "pcb_fabrication_note_path") {
      const path = pcb_fabrication_note_path.parse(element)
      records.push(
        ...createAltiumPcbPathRecords({
          altiumComponentIndex,
          circuitPoints: getCircuitPathPoints(element.route),
          circuitToAltiumPcbPoint,
          layer: getAltiumDocumentationLayer(path.layer),
          strokeWidthMm: path.stroke_width,
        }),
      )
    } else if (element.type === "pcb_note_path") {
      const path = pcb_note_path.parse(element)
      records.push(
        ...createAltiumPcbPathRecords({
          altiumComponentIndex,
          circuitPoints: getCircuitPathPoints(element.route),
          circuitToAltiumPcbPoint,
          layer: getAltiumDocumentationLayer(path.layer),
          strokeWidthMm: path.stroke_width,
        }),
      )
    } else if (element.type === "pcb_note_line") {
      const line = pcb_note_line.parse(element)
      if (line.is_dashed) {
        throw new Error("Altium PCB note lines do not preserve dashed strokes")
      }
      records.push(
        ...createAltiumPcbPathRecords({
          altiumComponentIndex,
          circuitPoints: [
            { x: line.x1, y: line.y1 },
            { x: line.x2, y: line.y2 },
          ],
          circuitToAltiumPcbPoint,
          layer: getAltiumDocumentationLayer(line.layer),
          strokeWidthMm: line.stroke_width,
        }),
      )
    } else if (element.type === "pcb_fabrication_note_rect") {
      const rectangle = pcb_fabrication_note_rect.parse(element)
      records.push(
        ...createDocumentationRectRecords({
          altiumComponentIndex,
          center: rectangle.center,
          circuitToAltiumPcbPoint,
          cornerRadiusMm: rectangle.corner_radius ?? 0,
          hasStroke: rectangle.has_stroke !== false,
          heightMm: rectangle.height,
          isFilled: rectangle.is_filled === true,
          isStrokeDashed: rectangle.is_stroke_dashed === true,
          layer: getAltiumDocumentationLayer(rectangle.layer),
          strokeWidthMm: rectangle.stroke_width,
          widthMm: rectangle.width,
        }),
      )
    } else if (element.type === "pcb_note_rect") {
      const rectangle = pcb_note_rect.parse(element)
      records.push(
        ...createDocumentationRectRecords({
          altiumComponentIndex,
          center: rectangle.center,
          circuitToAltiumPcbPoint,
          cornerRadiusMm: rectangle.corner_radius ?? 0,
          hasStroke: rectangle.has_stroke !== false,
          heightMm: rectangle.height,
          isFilled: rectangle.is_filled === true,
          isStrokeDashed: rectangle.is_stroke_dashed === true,
          layer: getAltiumDocumentationLayer(rectangle.layer),
          strokeWidthMm: rectangle.stroke_width,
          widthMm: rectangle.width,
        }),
      )
    } else if (element.type === "pcb_fabrication_note_text") {
      const text = pcb_fabrication_note_text.parse(element)
      records.push(
        createPcbTextRecord({
          altiumComponentIndex,
          circuitText: element,
          circuitToAltiumPcbPoint,
          layer: getAltiumDocumentationLayer(text.layer),
        }),
      )
    } else if (element.type === "pcb_note_text") {
      const text = pcb_note_text.parse(element)
      records.push(
        createPcbTextRecord({
          altiumComponentIndex,
          circuitText: element,
          circuitToAltiumPcbPoint,
          layer: getAltiumDocumentationLayer(text.layer),
        }),
      )
    } else if (element.type === "pcb_fabrication_note_dimension") {
      const dimension = pcb_fabrication_note_dimension.parse(element)
      records.push(
        createPcbDimensionRecord({
          altiumComponentIndex,
          circuitToAltiumPcbPoint,
          dimension,
          layer: getAltiumDocumentationLayer(dimension.layer),
        }),
      )
    } else if (element.type === "pcb_note_dimension") {
      const dimension = pcb_note_dimension.parse(element)
      records.push(
        createPcbDimensionRecord({
          altiumComponentIndex,
          circuitToAltiumPcbPoint,
          dimension,
          layer: getAltiumDocumentationLayer(dimension.layer),
        }),
      )
    }
  }

  return records
}

function isPcbDocumentationElement(element: CircuitElement): boolean {
  return [
    "pcb_fabrication_note_dimension",
    "pcb_fabrication_note_path",
    "pcb_fabrication_note_rect",
    "pcb_fabrication_note_text",
    "pcb_note_dimension",
    "pcb_note_line",
    "pcb_note_path",
    "pcb_note_rect",
    "pcb_note_text",
  ].includes(element.type ?? "")
}

function createDocumentationRectRecords({
  altiumComponentIndex,
  center,
  circuitToAltiumPcbPoint,
  cornerRadiusMm,
  hasStroke,
  heightMm,
  isFilled,
  isStrokeDashed,
  layer,
  strokeWidthMm,
  widthMm,
}: {
  altiumComponentIndex?: number
  center: Point
  circuitToAltiumPcbPoint: PointTransform
  cornerRadiusMm: number
  hasStroke: boolean
  heightMm: number
  isFilled: boolean
  isStrokeDashed: boolean
  layer: string
  strokeWidthMm: number
  widthMm: number
}): string[] {
  if (isStrokeDashed) {
    throw new Error("Altium PCB note rectangles do not preserve dashed strokes")
  }
  const circuitPoints = createRoundedRectPoints({
    center,
    cornerRadiusMm,
    heightMm,
    widthMm,
  })
  const records: string[] = []
  if (isFilled) {
    records.push(
      cornerRadiusMm === 0
        ? createAltiumFillRecord({
            altiumComponentIndex,
            center,
            circuitToAltiumPcbPoint,
            heightMm,
            layer,
            widthMm,
          })
        : createAltiumRegionRecord({
            altiumComponentIndex,
            circuitPoints,
            circuitToAltiumPcbPoint,
            layer,
          }),
    )
  }
  if (hasStroke) {
    records.push(
      ...createAltiumPcbPathRecords({
        altiumComponentIndex,
        circuitPoints,
        circuitToAltiumPcbPoint,
        closePath: true,
        layer,
        strokeWidthMm,
      }),
    )
  }
  return records
}

function getAltiumComponentIndex({
  componentIndex,
  element,
}: {
  componentIndex: ReadonlyMap<PcbComponentId, number>
  element: CircuitElement
}): number | undefined {
  if (typeof element.pcb_component_id !== "string") return undefined
  const altiumComponentIndex = componentIndex.get(element.pcb_component_id)
  if (altiumComponentIndex === undefined) {
    throw new Error(
      `PCB annotation references missing component ${element.pcb_component_id}`,
    )
  }
  return altiumComponentIndex
}

function getAltiumDocumentationLayer(circuitLayer: string): string {
  return circuitLayer.toLowerCase() === "bottom" ? "MECHANICAL2" : "MECHANICAL1"
}
