import {
  type AltiumComponentRecord,
  type AltiumNetRecord,
  type AltiumPcbDocument,
  type AltiumPoint,
  type AltiumRecord,
  getPcbContour,
  getPcbRegionGeometry,
  getPcbRegionSemanticKind,
  normalizeAltiumAngle,
  parseAltiumMeasurementToMils,
} from "altiumts"
import type { NinePointAnchor } from "circuit-json"
import type { CircuitElement } from "../../lib/types"
import { convertAltiumPcbAnnotationsToCircuitJson } from "./convert-altium-pcb-annotations-to-circuit-json"
import { convertAltiumPcbComponentBodiesToCircuitJson } from "./convert-altium-pcb-component-bodies-to-circuit-json"

const MILLIMETERS_PER_MIL = 0.0254

type CircuitPoint = {
  x: number
  y: number
}

type CircuitCopperLayer =
  | "bottom"
  | "inner1"
  | "inner2"
  | "inner3"
  | "inner4"
  | "inner5"
  | "inner6"
  | "inner7"
  | "inner8"
  | "top"

const CIRCUIT_INNER_COPPER_LAYERS = [
  "inner1",
  "inner2",
  "inner3",
  "inner4",
  "inner5",
  "inner6",
  "inner7",
  "inner8",
] as const

type SourceNetLookupContext = {
  document: AltiumPcbDocument
  sourceNetIds: Map<AltiumNetRecord, string>
}

function toCircuitPoint(point: AltiumPoint): CircuitPoint {
  return {
    x: point.x * MILLIMETERS_PER_MIL,
    y: point.y * MILLIMETERS_PER_MIL,
  }
}

function toCircuitLength(mils: number): number {
  return mils * MILLIMETERS_PER_MIL
}

function getMeasurementMils(
  record: AltiumRecord,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = parseAltiumMeasurementToMils(record.getCaseInsensitive(key))
    if (value !== undefined) return value
  }
  return undefined
}

function getPoint(
  record: AltiumRecord,
  xKey: string,
  yKey: string,
): AltiumPoint | undefined {
  const x = getMeasurementMils(record, xKey)
  const y = getMeasurementMils(record, yKey)
  return x === undefined || y === undefined ? undefined : { x, y }
}

function toCircuitRotation(altiumCcwDegrees: number): number {
  return normalizeAltiumAngle(altiumCcwDegrees)
}

function normalizeLayer(layer: string | undefined): string {
  return layer?.replace(/[\s_-]+/gu, "").toUpperCase() ?? ""
}

function toCircuitLayer(layer: string | undefined): "bottom" | "top" {
  return normalizeLayer(layer).includes("BOTTOM") ? "bottom" : "top"
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

function toCircuitCopperLayer(
  layer: string | undefined,
): CircuitCopperLayer | undefined {
  const normalized = normalizeLayer(layer)
  if (normalized === "TOP") return "top"
  if (normalized === "BOTTOM") return "bottom"
  const innerLayerMatch = /^MIDLAYER([1-8])$/u.exec(normalized)
  if (!innerLayerMatch?.[1]) return undefined
  return CIRCUIT_INNER_COPPER_LAYERS[Number(innerLayerMatch[1]) - 1]
}

function isCopperLayer(layer: string | undefined): boolean {
  const normalized = normalizeLayer(layer)
  return (
    normalized === "TOP" ||
    normalized === "BOTTOM" ||
    normalized.startsWith("MIDLAYER") ||
    normalized.startsWith("INTERNALPLANE")
  )
}

function isOverlayLayer(layer: string | undefined): boolean {
  const normalized = normalizeLayer(layer)
  return normalized === "TOPOVERLAY" || normalized === "BOTTOMOVERLAY"
}

function toCircuitPadShape(shape: string | undefined): "circle" | "rect" {
  const normalized = shape?.toUpperCase() ?? ""
  return normalized.includes("ROUND") || normalized.includes("CIRCLE")
    ? "circle"
    : "rect"
}

function createArcPoints(record: AltiumRecord): AltiumPoint[] {
  const center =
    getPoint(record, "LOCATION.X", "LOCATION.Y") ?? getPoint(record, "X", "Y")
  const radius = getMeasurementMils(record, "RADIUS")
  if (!center || radius === undefined || radius <= 0) return []

  const startAngle = record.getNumber("STARTANGLE") ?? 0
  const endAngle = record.getNumber("ENDANGLE") ?? 360
  const sweep = endAngle - startAngle || 360
  const segmentCount = Math.max(8, Math.ceil(Math.abs(sweep) / 7.5))

  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / segmentCount
    const radians = (angle * Math.PI) / 180
    return {
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    }
  })
}

function getText(record: AltiumRecord): string {
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

function getComponentIds(
  document: AltiumPcbDocument,
): Map<AltiumComponentRecord, string> {
  return new Map(
    document.components.map((component, index) => [
      component,
      `pcb_component_${index}`,
    ]),
  )
}

function getOwnedComponentId(
  document: AltiumPcbDocument,
  componentIds: Map<AltiumComponentRecord, string>,
  record: AltiumRecord,
): string | undefined {
  const component = document.getComponentForRecord(record)
  return component ? componentIds.get(component) : undefined
}

function isVisibleComponentText(
  document: AltiumPcbDocument,
  text: AltiumRecord,
): boolean {
  const component = document.getComponentForRecord(text)
  if (!component) return true
  if (
    text.getBoolean("DESIGNATOR") === true &&
    component.getBoolean("NAMEON") === false
  ) {
    return false
  }
  if (
    text.getBoolean("COMMENT") === true &&
    component.getBoolean("COMMENTON") === false
  ) {
    return false
  }
  return true
}

function appendNetConnection(
  elements: CircuitElement[],
  sourceTraceId: string,
  sourceNetId: string | undefined,
  sourcePortId?: string,
): void {
  elements.push({
    type: "source_trace",
    source_trace_id: sourceTraceId,
    ...(sourceNetId ? { connected_source_net_ids: [sourceNetId] } : {}),
    ...(sourcePortId ? { connected_source_port_ids: [sourcePortId] } : {}),
  })
}

function appendCopperTrace(
  elements: CircuitElement[],
  sourceTraceId: string,
  sourceNetId: string | undefined,
  layer: CircuitCopperLayer,
  widthMils: number,
  start: AltiumPoint,
  end: AltiumPoint,
): void {
  appendNetConnection(elements, sourceTraceId, sourceNetId)
  elements.push({
    type: "pcb_trace",
    pcb_trace_id: sourceTraceId.replace("source_trace", "pcb_trace"),
    source_trace_id: sourceTraceId,
    route: [start, end].map((point) => ({
      ...toCircuitPoint(point),
      layer,
      route_type: "wire",
      width: toCircuitLength(widthMils),
    })),
  })
}

function getSourceNetId(
  record: AltiumRecord,
  context: SourceNetLookupContext,
): string | undefined {
  const net = context.document.getNetForRecord(record)
  return net ? context.sourceNetIds.get(net) : undefined
}

function toCircuitBrepRing(points: AltiumPoint[]): CircuitPoint[] {
  const ring = points.map(toCircuitPoint)
  const firstPoint = ring[0]
  const lastPoint = ring.at(-1)
  if (
    firstPoint &&
    lastPoint &&
    firstPoint.x === lastPoint.x &&
    firstPoint.y === lastPoint.y
  ) {
    ring.pop()
  }
  return ring
}

function appendCopperPourElements({
  document,
  elements,
  sourceNetLookupContext,
}: {
  document: AltiumPcbDocument
  elements: CircuitElement[]
  sourceNetLookupContext: SourceNetLookupContext
}): void {
  const copperRegions = [
    ...document.getRecordsByKind("Region"),
    ...document.getRecordsByKind("RegionFill"),
  ].filter(
    (record) =>
      getPcbRegionSemanticKind(record) === "COPPER" &&
      record.getBoolean("KEEPOUT") !== true &&
      toCircuitCopperLayer(record.getDecoded("LAYER")) !== undefined,
  )
  const pouredPolygonIndexes = new Set(
    copperRegions.flatMap((region) => {
      const polygonIndex = region.getNumber("POLYGON")
      return polygonIndex === undefined || polygonIndex === 65_535
        ? []
        : [polygonIndex]
    }),
  )

  for (const [regionIndex, region] of copperRegions.entries()) {
    const layer = toCircuitCopperLayer(region.getDecoded("LAYER"))
    const geometry = getPcbRegionGeometry(region)
    if (!layer || geometry.outline.points.length < 3) continue
    const sourceNetId = getSourceNetId(region, sourceNetLookupContext)
    elements.push({
      type: "pcb_copper_pour",
      pcb_copper_pour_id: `pcb_copper_pour_region_${regionIndex}`,
      ...(sourceNetId ? { source_net_id: sourceNetId } : {}),
      covered_with_solder_mask: true,
      shape: "brep",
      brep_shape: {
        outer_ring: {
          vertices: toCircuitBrepRing(geometry.outline.points),
        },
        inner_rings: geometry.holes.map((hole) => ({
          vertices: toCircuitBrepRing(hole.points),
        })),
      },
      layer,
    })
  }

  for (const [polygonIndex, polygon] of document.polygons.entries()) {
    if (pouredPolygonIndexes.has(polygonIndex)) continue
    const layer = toCircuitCopperLayer(polygon.layer)
    const points = toCircuitBrepRing(getPcbContour(polygon).points)
    if (!layer || points.length < 3) continue
    const sourceNetId = getSourceNetId(polygon, sourceNetLookupContext)
    elements.push({
      type: "pcb_copper_pour",
      pcb_copper_pour_id: `pcb_copper_pour_polygon_${polygonIndex}`,
      ...(sourceNetId ? { source_net_id: sourceNetId } : {}),
      covered_with_solder_mask: true,
      shape: "polygon",
      points,
      layer,
    })
  }

  const copperFills = document
    .getRecordsByKind("Fill")
    .filter(
      (fill) =>
        fill.getBoolean("KEEPOUT") !== true &&
        toCircuitCopperLayer(fill.getDecoded("LAYER")) !== undefined,
    )
  for (const [fillIndex, fill] of copperFills.entries()) {
    const start = getPoint(fill, "X1", "Y1")
    const end = getPoint(fill, "X2", "Y2")
    const layer = toCircuitCopperLayer(fill.getDecoded("LAYER"))
    if (!start || !end || !layer) continue
    const sourceNetId = getSourceNetId(fill, sourceNetLookupContext)
    elements.push({
      type: "pcb_copper_pour",
      pcb_copper_pour_id: `pcb_copper_pour_fill_${fillIndex}`,
      ...(sourceNetId ? { source_net_id: sourceNetId } : {}),
      covered_with_solder_mask: true,
      shape: "rect",
      center: toCircuitPoint({
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      }),
      width: toCircuitLength(Math.abs(end.x - start.x)),
      height: toCircuitLength(Math.abs(end.y - start.y)),
      rotation: toCircuitRotation(fill.getNumber("ROTATION") ?? 0),
      layer,
    })
  }
}

export function convertAltiumPcbToCircuitJson(
  document: AltiumPcbDocument,
): CircuitElement[] {
  const elements: CircuitElement[] = []
  const outline = document.boardGeometry.outline.points.map(toCircuitPoint)
  elements.push({ type: "pcb_board", pcb_board_id: "pcb_board_0", outline })

  const sourceNetIds = new Map(
    document.nets.map((net, index) => [net, `source_net_${index}`]),
  )
  for (const [net, sourceNetId] of sourceNetIds) {
    elements.push({
      type: "source_net",
      source_net_id: sourceNetId,
      name: net.name ?? sourceNetId,
    })
  }
  const sourceNetLookupContext: SourceNetLookupContext = {
    document,
    sourceNetIds,
  }

  const componentIds = getComponentIds(document)
  for (const [component, pcbComponentId] of componentIds) {
    const componentIndex = document.components.indexOf(component)
    const sourceComponentId = `source_component_${componentIndex}`
    const position = component.position ?? { x: 0, y: 0 }
    const bounds = document.getComponentBounds(component)
    elements.push(
      {
        type: "source_component",
        source_component_id: sourceComponentId,
        name: component.designator ?? `Component-${componentIndex + 1}`,
      },
      {
        type: "pcb_component",
        pcb_component_id: pcbComponentId,
        source_component_id: sourceComponentId,
        center: toCircuitPoint(position),
        width: toCircuitLength(
          bounds ? Math.max(bounds.maxX - bounds.minX, 1) : 1,
        ),
        height: toCircuitLength(
          bounds ? Math.max(bounds.maxY - bounds.minY, 1) : 1,
        ),
        rotation: toCircuitRotation(component.rotation),
        layer: component.side === "bottom" ? "bottom" : "top",
      },
    )
  }

  for (const [padIndex, pad] of document.getRecordsByKind("Pad").entries()) {
    const position = getPoint(pad, "X", "Y")
    if (!position) continue

    const pcbComponentId = getOwnedComponentId(document, componentIds, pad)
    const sourcePortId = `source_port_${padIndex}`
    const pcbPortId = `pcb_port_${padIndex}`
    const pinName = pad.getDecoded("NAME") || String(padIndex + 1)
    const sourceComponentId = pcbComponentId?.replace(
      "pcb_component",
      "source_component",
    )
    const circuitPosition = toCircuitPoint(position)
    elements.push(
      {
        type: "source_port",
        source_port_id: sourcePortId,
        ...(sourceComponentId
          ? { source_component_id: sourceComponentId }
          : {}),
        name: pinName,
        pin_number: pinName,
      },
      {
        type: "pcb_port",
        pcb_port_id: pcbPortId,
        source_port_id: sourcePortId,
        ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
        x: circuitPosition.x,
        y: circuitPosition.y,
      },
    )

    const sourceNetId = getSourceNetId(pad, sourceNetLookupContext)
    if (sourceNetId) {
      appendNetConnection(
        elements,
        `source_trace_pad_${padIndex}`,
        sourceNetId,
        sourcePortId,
      )
    }

    const layer = pad.getDecoded("LAYER")
    const holeSizeMils = getMeasurementMils(pad, "HOLESIZE") ?? 0
    const outerWidthMils =
      getMeasurementMils(pad, "XSIZE", "TOPXSIZE") ??
      Math.max(holeSizeMils * 2, 1)
    const outerHeightMils =
      getMeasurementMils(pad, "YSIZE", "TOPYSIZE") ?? outerWidthMils
    const rotation = toCircuitRotation(pad.getNumber("ROTATION") ?? 0)
    const commonFields = {
      ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
      pcb_port_id: pcbPortId,
      x: circuitPosition.x,
      y: circuitPosition.y,
    }

    if (holeSizeMils <= 0 && normalizeLayer(layer) !== "MULTILAYER") {
      elements.push({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pcb_smtpad_${padIndex}`,
        ...commonFields,
        width: toCircuitLength(outerWidthMils),
        height: toCircuitLength(outerHeightMils),
        shape: toCircuitPadShape(pad.getDecoded("SHAPE")),
        ccw_rotation: rotation,
        layer: toCircuitLayer(layer),
      })
      continue
    }

    const holeWidthMils =
      getMeasurementMils(pad, "HOLEWIDTH", "SLOTLENGTH") ?? holeSizeMils
    const holeRotation = toCircuitRotation(
      pad.getNumber("HOLEROTATION") ??
        pad.getNumber("SLOTROTATION") ??
        pad.getNumber("ROTATION") ??
        0,
    )
    const holeFields = {
      ...commonFields,
      hole_width: toCircuitLength(Math.max(holeWidthMils, holeSizeMils)),
      hole_height: toCircuitLength(holeSizeMils),
      ccw_rotation: holeRotation,
    }
    if (pad.getBoolean("PLATED") === false) {
      elements.push({
        type: "pcb_hole",
        pcb_hole_id: `pcb_hole_${padIndex}`,
        ...holeFields,
      })
    } else {
      elements.push({
        type: "pcb_plated_hole",
        pcb_plated_hole_id: `pcb_plated_hole_${padIndex}`,
        ...holeFields,
        outer_width: toCircuitLength(outerWidthMils),
        outer_height: toCircuitLength(outerHeightMils),
        shape: toCircuitPadShape(pad.getDecoded("SHAPE")),
      })
    }
  }

  for (const [trackIndex, track] of document
    .getRecordsByKind("Track")
    .entries()) {
    const start = getPoint(track, "X1", "Y1")
    const end = getPoint(track, "X2", "Y2")
    const layer = track.getDecoded("LAYER")
    if (!start || !end || (start.x === end.x && start.y === end.y)) continue
    const widthMils = getMeasurementMils(track, "WIDTH") ?? 4
    if (isCopperLayer(layer)) {
      const circuitLayer = toCircuitCopperLayer(layer)
      if (!circuitLayer) continue
      appendCopperTrace(
        elements,
        `source_trace_track_${trackIndex}`,
        getSourceNetId(track, sourceNetLookupContext),
        circuitLayer,
        widthMils,
        start,
        end,
      )
    } else if (isOverlayLayer(layer)) {
      const pcbComponentId = getOwnedComponentId(document, componentIds, track)
      elements.push({
        type: "pcb_silkscreen_path",
        pcb_silkscreen_path_id: `pcb_silkscreen_path_track_${trackIndex}`,
        ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
        layer: toCircuitLayer(layer),
        stroke_width: toCircuitLength(widthMils),
        route: [start, end].map(toCircuitPoint),
      })
    }
  }

  for (const [arcIndex, arc] of document.getRecordsByKind("Arc").entries()) {
    const points = createArcPoints(arc)
    const layer = arc.getDecoded("LAYER")
    const widthMils = getMeasurementMils(arc, "WIDTH") ?? 4
    if (isCopperLayer(layer)) {
      const circuitLayer = toCircuitCopperLayer(layer)
      if (!circuitLayer) continue
      for (let segmentIndex = 1; segmentIndex < points.length; segmentIndex++) {
        const start = points[segmentIndex - 1]
        const end = points[segmentIndex]
        if (!start || !end) continue
        appendCopperTrace(
          elements,
          `source_trace_arc_${arcIndex}_${segmentIndex - 1}`,
          getSourceNetId(arc, sourceNetLookupContext),
          circuitLayer,
          widthMils,
          start,
          end,
        )
      }
    } else if (isOverlayLayer(layer) && points.length > 1) {
      const pcbComponentId = getOwnedComponentId(document, componentIds, arc)
      elements.push({
        type: "pcb_silkscreen_path",
        pcb_silkscreen_path_id: `pcb_silkscreen_path_arc_${arcIndex}`,
        ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
        layer: toCircuitLayer(layer),
        stroke_width: toCircuitLength(widthMils),
        route: points.map(toCircuitPoint),
      })
    }
  }

  for (const [viaIndex, via] of document.getRecordsByKind("Via").entries()) {
    const position = getPoint(via, "X", "Y")
    if (!position) continue
    const sourceNetId = getSourceNetId(via, sourceNetLookupContext)
    const sourceTraceId = `source_trace_via_${viaIndex}`
    if (sourceNetId) {
      appendNetConnection(elements, sourceTraceId, sourceNetId)
    }
    elements.push({
      type: "pcb_via",
      pcb_via_id: `pcb_via_${viaIndex}`,
      ...(sourceNetId ? { source_trace_id: sourceTraceId } : {}),
      ...toCircuitPoint(position),
      outer_diameter: toCircuitLength(
        getMeasurementMils(via, "DIAMETER", "TOPLAYERSIZE") ?? 20,
      ),
      hole_diameter: toCircuitLength(getMeasurementMils(via, "HOLESIZE") ?? 10),
    })
  }

  appendCopperPourElements({
    document,
    elements,
    sourceNetLookupContext,
  })

  for (const [textIndex, text] of document.getRecordsByKind("Text").entries()) {
    const layer = text.getDecoded("LAYER")
    const position = getPoint(text, "X", "Y")
    if (
      !position ||
      !isOverlayLayer(layer) ||
      !isVisibleComponentText(document, text)
    ) {
      continue
    }
    const pcbComponentId = getOwnedComponentId(document, componentIds, text)
    elements.push({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: `pcb_silkscreen_text_${textIndex}`,
      ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
      text: getText(text),
      anchor_position: toCircuitPoint(position),
      anchor_alignment: toCircuitTextAnchorAlignment(
        text.getNumber("JUSTIFICATION"),
      ),
      font_size: toCircuitLength(getMeasurementMils(text, "HEIGHT") ?? 30),
      font: "tscircuit2024",
      ccw_rotation: toCircuitRotation(text.getNumber("ROTATION") ?? 0),
      is_mirrored:
        text.getBoolean("MIRROR") ?? toCircuitLayer(layer) === "bottom",
      layer: toCircuitLayer(layer),
    })
  }

  elements.push(
    ...convertAltiumPcbComponentBodiesToCircuitJson({
      componentIds,
      document,
      toCircuitLength,
      toCircuitPoint,
    }),
    ...convertAltiumPcbAnnotationsToCircuitJson({ componentIds, document }),
  )

  return elements
}
