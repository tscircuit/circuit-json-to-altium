import {
  type AltiumComponentRecord,
  AltiumDimensionRecord,
  type AltiumPcbDocument,
  type AltiumPoint,
  type AltiumRecord,
} from "altiumts"
import type { NinePointAnchor } from "circuit-json"
import type { CircuitElement } from "../../lib/types"
import {
  type AltiumPcbAnnotationPoint,
  getAltiumCircleFromPath,
  getAltiumPcbAnnotationPaths,
  getAltiumPcbMeasurementMils,
  getAltiumPcbPoint,
  getAltiumRectFromPath,
  isClosedAltiumPath,
} from "./get-altium-pcb-annotation-paths"

const MILLIMETERS_PER_MIL = 0.0254

export function convertAltiumPcbAnnotationsToCircuitJson({
  componentIds,
  document,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
}): CircuitElement[] {
  return [
    ...convertCourtyardPaths({ componentIds, document }),
    ...convertDocumentationPaths({ componentIds, document }),
    ...convertDocumentationTexts({ componentIds, document }),
    ...convertDimensions({ componentIds, document }),
    ...convertKeepouts({ componentIds, document }),
  ]
}

function convertCourtyardPaths({
  componentIds,
  document,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
}): CircuitElement[] {
  const paths = getAltiumPcbAnnotationPaths({
    componentIds,
    document,
    includeRecord: isCourtyardGraphicRecord,
  })
  const elements: CircuitElement[] = []
  for (const [pathIndex, path] of paths.entries()) {
    const circle = getAltiumCircleFromPath(path)
    if (path.componentId && circle) {
      elements.push({
        type: "pcb_courtyard_circle",
        pcb_courtyard_circle_id: `pcb_courtyard_circle_${pathIndex}`,
        pcb_component_id: path.componentId,
        layer: toCircuitVisibleLayer(path.layer),
        center: toCircuitPoint(circle.center),
        radius: toCircuitLength(circle.radiusMils),
      })
      continue
    }
    if (path.componentId && isClosedAltiumPath(path)) {
      elements.push({
        type: "pcb_courtyard_outline",
        pcb_courtyard_outline_id: `pcb_courtyard_outline_${pathIndex}`,
        pcb_component_id: path.componentId,
        layer: toCircuitVisibleLayer(path.layer),
        outline: path.points.map(toCircuitAnnotationPoint),
      })
      continue
    }
    elements.push(
      path.componentId
        ? {
            type: "pcb_fabrication_note_path",
            pcb_fabrication_note_path_id: `pcb_fabrication_note_path_courtyard_${pathIndex}`,
            pcb_component_id: path.componentId,
            layer: toCircuitVisibleLayer(path.layer),
            route: path.points.map(toCircuitAnnotationPoint),
            stroke_width: toCircuitLength(path.strokeWidthMils),
          }
        : {
            type: "pcb_note_path",
            pcb_note_path_id: `pcb_note_path_courtyard_${pathIndex}`,
            layer: toCircuitVisibleLayer(path.layer),
            route: path.points.map(toCircuitAnnotationPoint),
            stroke_width: toCircuitLength(path.strokeWidthMils),
          },
    )
  }
  return elements
}

function convertDocumentationPaths({
  componentIds,
  document,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
}): CircuitElement[] {
  const paths = getAltiumPcbAnnotationPaths({
    componentIds,
    document,
    includeRecord: isDocumentationGraphicRecord,
  })
  return paths.map((path, pathIndex) =>
    path.componentId
      ? {
          type: "pcb_fabrication_note_path",
          pcb_fabrication_note_path_id: `pcb_fabrication_note_path_${pathIndex}`,
          pcb_component_id: path.componentId,
          layer: toCircuitVisibleLayer(path.layer),
          route: path.points.map(toCircuitAnnotationPoint),
          stroke_width: toCircuitLength(path.strokeWidthMils),
        }
      : {
          type: "pcb_note_path",
          pcb_note_path_id: `pcb_note_path_${pathIndex}`,
          layer: toCircuitVisibleLayer(path.layer),
          route: path.points.map(toCircuitAnnotationPoint),
          stroke_width: toCircuitLength(path.strokeWidthMils),
        },
  )
}

function convertDocumentationTexts({
  componentIds,
  document,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
}): CircuitElement[] {
  const elements: CircuitElement[] = []
  for (const [textIndex, text] of document.getRecordsByKind("Text").entries()) {
    const layer = text.getDecoded("LAYER") ?? ""
    if (!isDocumentationLayer(layer) && !isCourtyardLayer(layer)) continue
    const position = getAltiumPcbPoint({
      record: text,
      xFieldName: "X",
      yFieldName: "Y",
    })
    if (!position) continue
    const component = document.getComponentForRecord(text)
    const componentId = component ? componentIds.get(component) : undefined
    const sharedFields = {
      font: "tscircuit2024",
      font_size: toCircuitLength(
        getAltiumPcbMeasurementMils({
          fieldNames: ["HEIGHT"],
          record: text,
        }) ?? 30,
      ),
      text: getAltiumText(text),
      ccw_rotation: toCircuitRotation(text.getNumber("ROTATION") ?? 0),
      layer: toCircuitVisibleLayer(layer),
      anchor_position: toCircuitPoint(position),
      anchor_alignment: toCircuitTextAnchorAlignment(
        text.getNumber("JUSTIFICATION"),
      ),
    }
    elements.push(
      componentId
        ? {
            type: "pcb_fabrication_note_text",
            pcb_fabrication_note_text_id: `pcb_fabrication_note_text_${textIndex}`,
            pcb_component_id: componentId,
            ...sharedFields,
          }
        : {
            type: "pcb_note_text",
            pcb_note_text_id: `pcb_note_text_${textIndex}`,
            ...sharedFields,
            is_mirrored_from_top_view:
              text.getBoolean("MIRROR") ??
              toCircuitVisibleLayer(layer) === "bottom",
          },
    )
  }
  return elements
}

function convertDimensions({
  componentIds,
  document,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
}): CircuitElement[] {
  const elements: CircuitElement[] = []
  for (const [index, record] of document
    .getRecordsByKind("Dimension")
    .entries()) {
    if (!(record instanceof AltiumDimensionRecord)) continue
    const start = record.start
    const end = record.end
    const lineAnchor = record.dimensionLineAnchor
    if (!start || !end || !lineAnchor) continue
    const component = document.getComponentForRecord(record)
    const componentId = component ? componentIds.get(component) : undefined
    const circuitStart = toCircuitPoint(start)
    const circuitLineAnchor = toCircuitPoint(lineAnchor)
    const offsetX = circuitLineAnchor.x - circuitStart.x
    const offsetY = circuitLineAnchor.y - circuitStart.y
    const offsetDistance = Math.hypot(offsetX, offsetY)
    const textFormat = record.getDecoded("TEXTFORMAT")?.trim()
    const sharedFields = {
      layer: toCircuitVisibleLayer(record.getDecoded("LAYER") ?? ""),
      from: circuitStart,
      to: toCircuitPoint(end),
      ...(textFormat && textFormat !== "<>" ? { text: textFormat } : {}),
      offset_distance: offsetDistance,
      ...(offsetDistance > 0
        ? {
            offset_direction: {
              x: offsetX / offsetDistance,
              y: offsetY / offsetDistance,
            },
          }
        : {}),
      font: "tscircuit2024",
      font_size: toCircuitLength(record.textHeightMils ?? 50),
      arrow_size: toCircuitLength(
        getAltiumPcbMeasurementMils({
          fieldNames: ["ARROWSIZE"],
          record,
        }) ?? 40,
      ),
    }
    elements.push(
      componentId
        ? {
            type: "pcb_fabrication_note_dimension",
            pcb_fabrication_note_dimension_id: `pcb_fabrication_note_dimension_${index}`,
            pcb_component_id: componentId,
            ...sharedFields,
          }
        : {
            type: "pcb_note_dimension",
            pcb_note_dimension_id: `pcb_note_dimension_${index}`,
            ...sharedFields,
          },
    )
  }
  return elements
}

function convertKeepouts({
  componentIds,
  document,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
}): CircuitElement[] {
  const keepouts: CircuitElement[] = []
  for (const [fillIndex, fill] of document.getRecordsByKind("Fill").entries()) {
    if (!isKeepoutRecord(fill) || (fill.getNumber("ROTATION") ?? 0) !== 0) {
      continue
    }
    const start = getAltiumPcbPoint({
      record: fill,
      xFieldName: "X1",
      yFieldName: "Y1",
    })
    const end = getAltiumPcbPoint({
      record: fill,
      xFieldName: "X2",
      yFieldName: "Y2",
    })
    if (!start || !end) continue
    keepouts.push({
      type: "pcb_keepout",
      pcb_keepout_id: `pcb_keepout_fill_${fillIndex}`,
      shape: "rect",
      center: toCircuitPoint({
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      }),
      width: toCircuitLength(Math.abs(end.x - start.x)),
      height: toCircuitLength(Math.abs(end.y - start.y)),
      layers: toCircuitKeepoutLayers(fill.getDecoded("LAYER")),
    })
  }

  const keepoutPaths = getAltiumPcbAnnotationPaths({
    componentIds,
    document,
    includeRecord: isKeepoutGraphicRecord,
  })
  for (const [pathIndex, path] of keepoutPaths.entries()) {
    const circle = getAltiumCircleFromPath(path)
    if (circle) {
      keepouts.push({
        type: "pcb_keepout",
        pcb_keepout_id: `pcb_keepout_circle_${pathIndex}`,
        shape: "circle",
        center: toCircuitPoint(circle.center),
        radius: toCircuitLength(circle.radiusMils),
        layers: toCircuitKeepoutLayers(path.layer),
      })
      continue
    }
    const rectangle = getAltiumRectFromPath(path)
    if (!rectangle) continue
    keepouts.push({
      type: "pcb_keepout",
      pcb_keepout_id: `pcb_keepout_rect_${pathIndex}`,
      shape: "rect",
      center: toCircuitPoint(rectangle.center),
      width: toCircuitLength(rectangle.widthMils),
      height: toCircuitLength(rectangle.heightMils),
      layers: toCircuitKeepoutLayers(path.layer),
    })
  }
  return keepouts
}

function isCourtyardGraphicRecord(record: AltiumRecord): boolean {
  return (
    ["Arc", "Region", "RegionFill", "Track"].includes(
      record.recordKind ?? "",
    ) && isCourtyardLayer(record.getDecoded("LAYER") ?? "")
  )
}

function isDocumentationGraphicRecord(record: AltiumRecord): boolean {
  return (
    ["Arc", "Region", "RegionFill", "Track"].includes(
      record.recordKind ?? "",
    ) && isDocumentationLayer(record.getDecoded("LAYER") ?? "")
  )
}

function isKeepoutGraphicRecord(record: AltiumRecord): boolean {
  return (
    ["Arc", "Region", "RegionFill", "Track"].includes(
      record.recordKind ?? "",
    ) && isKeepoutRecord(record)
  )
}

function isKeepoutRecord(record: AltiumRecord): boolean {
  return (
    record.getBoolean("KEEPOUT") === true ||
    normalizeLayer(record.getDecoded("LAYER") ?? "") === "KEEPOUT"
  )
}

function isCourtyardLayer(layer: string): boolean {
  const normalizedLayer = normalizeLayer(layer)
  return (
    normalizedLayer === "MECHANICAL15" || normalizedLayer === "MECHANICAL16"
  )
}

function isDocumentationLayer(layer: string): boolean {
  const normalizedLayer = normalizeLayer(layer)
  return normalizedLayer === "MECHANICAL1" || normalizedLayer === "MECHANICAL2"
}

function toCircuitKeepoutLayers(layer: string | undefined): string[] {
  const normalizedLayer = normalizeLayer(layer ?? "")
  if (normalizedLayer === "TOP") return ["top"]
  if (normalizedLayer === "BOTTOM") return ["bottom"]
  const innerLayerMatch = /^MIDLAYER(\d+)$/u.exec(normalizedLayer)
  return innerLayerMatch?.[1] ? [`inner${innerLayerMatch[1]}`] : ["all"]
}

function toCircuitVisibleLayer(layer: string): "bottom" | "top" {
  const normalizedLayer = normalizeLayer(layer)
  return normalizedLayer === "MECHANICAL2" || normalizedLayer === "MECHANICAL16"
    ? "bottom"
    : "top"
}

function toCircuitPoint(point: AltiumPoint): { x: number; y: number } {
  return {
    x: point.x * MILLIMETERS_PER_MIL,
    y: point.y * MILLIMETERS_PER_MIL,
  }
}

function toCircuitAnnotationPoint(point: AltiumPcbAnnotationPoint): {
  bulge?: number
  x: number
  y: number
} {
  return {
    ...toCircuitPoint(point),
    ...(point.bulge === undefined ? {} : { bulge: point.bulge }),
  }
}

function toCircuitLength(mils: number): number {
  return mils * MILLIMETERS_PER_MIL
}

function toCircuitRotation(altiumCcwDegrees: number): number {
  return ((altiumCcwDegrees % 360) + 360) % 360
}

function toCircuitTextAnchorAlignment(
  altiumJustification: number | undefined,
): NinePointAnchor {
  switch (altiumJustification) {
    case 1:
      return "top_left"
    case 2:
      return "center_left"
    case 4:
      return "top_center"
    case 5:
      return "center"
    case 6:
      return "bottom_center"
    case 7:
      return "top_right"
    case 8:
      return "center_right"
    case 9:
      return "bottom_right"
    default:
      return "bottom_left"
  }
}

function getAltiumText(record: AltiumRecord): string {
  const wideString = record.getDecoded("WIDESTRING")
  if (!wideString) return record.getDecoded("TEXT") ?? ""
  if (!/^\d+(?:,\d+)*$/u.test(wideString)) return wideString
  try {
    return String.fromCodePoint(
      ...wideString.split(",").map((codePoint) => Number(codePoint)),
    )
  } catch {
    return wideString
  }
}

function normalizeLayer(layer: string): string {
  return layer.replace(/[\s_-]+/gu, "").toUpperCase()
}
