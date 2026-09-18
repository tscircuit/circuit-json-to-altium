import type { CircuitElement } from "../../lib/types"
import {
  getPcbSemanticContext,
  type PcbSemanticContext,
} from "./get-pcb-semantic-context"
import {
  asNumber,
  asPoint,
  asPoints,
  asString,
  asStrings,
  formatLayer,
  formatNumber,
  formatPoint,
  getClosedPathSegmentSignatures,
  getPathSegmentSignatures,
  getSemanticSignatureMismatches,
  type PcbSemanticPoint,
} from "./pcb-semantic-signature-utils"

// Matches the converter fallback for non-positive source stroke widths.
const DEFAULT_SILKSCREEN_STROKE_WIDTH_MM = 0.15

type CopperPourRing = {
  kind: "inner" | "outer"
  points: PcbSemanticPoint[]
}

export type PcbSemanticSignatures = {
  annotationPathSegments: string[]
  annotationTexts: string[]
  boardOutlineSegments: string[]
  copperPourSegments: string[]
  copperTraceSegments: string[]
  keepouts: string[]
  silkscreenPathSegments: string[]
  silkscreenTexts: string[]
  sourceConnectivity: string[]
  vias: string[]
}

function getSourceConnectivitySignatures({
  circuitJson,
  context,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
}): string[] {
  return circuitJson
    .flatMap((element) => {
      if (element.type !== "source_trace") return []
      const netNames = asStrings(element.connected_source_net_ids)
        .map(
          (sourceNetId) =>
            context.sourceNetNameById.get(sourceNetId) ?? "<missing>",
        )
        .sort()
      const portDescriptors = asStrings(element.connected_source_port_ids)
        .map(
          (sourcePortId) =>
            context.sourcePortDescriptorById.get(sourcePortId) ?? "<missing>",
        )
        .sort()
      return [
        `nets=${JSON.stringify(netNames)}|ports=${JSON.stringify(portDescriptors)}`,
      ]
    })
    .sort()
}

function getCopperTraceSegmentSignatures({
  circuitJson,
  context,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
}): string[] {
  return circuitJson
    .flatMap((element) => {
      if (element.type !== "pcb_trace") return []
      const sourceTraceId = asString(element.source_trace_id)
      const netNames = sourceTraceId
        ? (context.netNamesBySourceTraceId.get(sourceTraceId) ?? [])
        : []
      const route = Array.isArray(element.route) ? element.route : []
      return route.slice(0, -1).flatMap((rawStart, index) => {
        const rawEnd = route[index + 1]
        const start = asPoint(rawStart)
        const end = asPoint(rawEnd)
        if (!start || !end) return []
        const routeLayer =
          typeof rawStart === "object" &&
          rawStart !== null &&
          "layer" in rawStart
            ? rawStart.layer
            : element.layer
        const routeWidth =
          typeof rawStart === "object" &&
          rawStart !== null &&
          "width" in rawStart
            ? asNumber(rawStart.width)
            : asNumber(element.width)
        const style = [
          `nets=${JSON.stringify(netNames)}`,
          `layer=${formatLayer(routeLayer)}`,
          `width=${formatNumber(routeWidth)}`,
        ].join("|")
        return getPathSegmentSignatures({
          origin: context.origin,
          points: [start, end],
          style,
        })
      })
    })
    .sort()
}

function getViaSignatures({
  circuitJson,
  context,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
}): string[] {
  return circuitJson
    .flatMap((element) => {
      if (element.type !== "pcb_via") return []
      const point = asPoint(element)
      if (!point) return []
      const sourceTraceId = asString(element.source_trace_id)
      const netNames = sourceTraceId
        ? (context.netNamesBySourceTraceId.get(sourceTraceId) ?? [])
        : []
      return [
        [
          `nets=${JSON.stringify(netNames)}`,
          `at=${formatPoint(point, context.origin)}`,
          `outer=${formatNumber(asNumber(element.outer_diameter))}`,
          `hole=${formatNumber(asNumber(element.hole_diameter))}`,
          `from=${formatLayer(element.from_layer)}`,
          `to=${formatLayer(element.to_layer)}`,
        ].join("|"),
      ]
    })
    .sort()
}

function rotatePointAroundCenter({
  center,
  point,
  rotationDegrees,
}: {
  center: PcbSemanticPoint
  point: PcbSemanticPoint
  rotationDegrees: number
}): PcbSemanticPoint {
  const radians = (rotationDegrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: center.x + point.x * cosine - point.y * sine,
    y: center.y + point.x * sine + point.y * cosine,
  }
}

function getCopperPourRings(element: CircuitElement): CopperPourRing[] {
  if (element.shape === "polygon") {
    return [{ kind: "outer", points: asPoints(element.points) }]
  }
  if (element.shape === "rect") {
    const center = asPoint(element.center)
    const width = asNumber(element.width)
    const height = asNumber(element.height)
    if (!center || width === undefined || height === undefined) return []
    const halfWidth = width / 2
    const halfHeight = height / 2
    const rotationDegrees = asNumber(element.rotation) ?? 0
    return [
      {
        kind: "outer",
        points: [
          { x: -halfWidth, y: -halfHeight },
          { x: halfWidth, y: -halfHeight },
          { x: halfWidth, y: halfHeight },
          { x: -halfWidth, y: halfHeight },
        ].map((point) =>
          rotatePointAroundCenter({ center, point, rotationDegrees }),
        ),
      },
    ]
  }
  if (element.shape !== "brep") return []
  const brepShape = element.brep_shape
  if (typeof brepShape !== "object" || brepShape === null) return []
  const outerRing =
    "outer_ring" in brepShape &&
    typeof brepShape.outer_ring === "object" &&
    brepShape.outer_ring !== null &&
    "vertices" in brepShape.outer_ring
      ? asPoints(brepShape.outer_ring.vertices)
      : []
  const innerRings =
    "inner_rings" in brepShape && Array.isArray(brepShape.inner_rings)
      ? brepShape.inner_rings.flatMap((ring) => {
          if (
            typeof ring !== "object" ||
            ring === null ||
            !("vertices" in ring)
          ) {
            return []
          }
          return [{ kind: "inner" as const, points: asPoints(ring.vertices) }]
        })
      : []
  return [{ kind: "outer", points: outerRing }, ...innerRings]
}

function getCopperPourSegmentSignatures({
  circuitJson,
  context,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
}): string[] {
  return circuitJson
    .flatMap((element) => {
      if (element.type !== "pcb_copper_pour") return []
      const sourceNetId = asString(element.source_net_id)
      const netName = sourceNetId
        ? (context.sourceNetNameById.get(sourceNetId) ?? "<missing>")
        : ""
      const style = [
        `net=${JSON.stringify(netName)}`,
        `layer=${formatLayer(element.layer)}`,
        `covered=${String(element.covered_with_solder_mask === true)}`,
      ].join("|")
      return getCopperPourRings(element).flatMap((ring) =>
        getClosedPathSegmentSignatures({
          origin: context.origin,
          points: ring.points,
          style: `${style}|ring=${ring.kind}`,
        }),
      )
    })
    .sort()
}

function getBoardOutlineSegmentSignatures({
  circuitJson,
  context,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
}): string[] {
  return circuitJson
    .flatMap((element) =>
      element.type === "pcb_board"
        ? getClosedPathSegmentSignatures({
            origin: context.origin,
            points: asPoints(element.outline),
            style: "board-outline",
          })
        : [],
    )
    .sort()
}

function getComponentOwnedPathSegmentSignatures({
  circuitJson,
  context,
  deduplicate,
  elementTypes,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
  deduplicate: boolean
  elementTypes: Set<string>
}): string[] {
  const signatures = circuitJson.flatMap((element) => {
    if (!element.type || !elementTypes.has(element.type)) return []
    const pcbComponentId = asString(element.pcb_component_id)
    const component = pcbComponentId
      ? (context.componentDescriptorByPcbComponentId.get(pcbComponentId) ??
        "<missing>")
      : "<standalone>"
    const strokeWidth = asNumber(element.stroke_width)
    const normalizedStrokeWidth =
      element.type === "pcb_silkscreen_path" &&
      (strokeWidth === undefined || strokeWidth <= 0)
        ? DEFAULT_SILKSCREEN_STROKE_WIDTH_MM
        : strokeWidth
    const style = [
      `type=${element.type}`,
      `component=${component}`,
      `layer=${formatLayer(element.layer)}`,
      `stroke=${formatNumber(normalizedStrokeWidth)}`,
      `color=${JSON.stringify(asString(element.color) ?? "")}`,
    ].join("|")
    const points = asPoints(element.route ?? element.outline)
    return element.type === "pcb_courtyard_outline"
      ? getClosedPathSegmentSignatures({
          origin: context.origin,
          points,
          style,
        })
      : getPathSegmentSignatures({
          origin: context.origin,
          points,
          style,
        })
  })
  return [...(deduplicate ? new Set(signatures) : signatures)].sort()
}

function getTextSignatures({
  circuitJson,
  context,
  elementTypes,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
  elementTypes: Set<string>
}): string[] {
  return circuitJson
    .flatMap((element) => {
      if (!element.type || !elementTypes.has(element.type)) return []
      const anchorPosition = asPoint(element.anchor_position)
      const text = asString(element.text) ?? ""
      const fontSize = asNumber(element.font_size) ?? 0
      if (!anchorPosition || text.length === 0 || fontSize <= 0) return []
      const pcbComponentId = asString(element.pcb_component_id)
      const component = pcbComponentId
        ? (context.componentDescriptorByPcbComponentId.get(pcbComponentId) ??
          "<missing>")
        : "<standalone>"
      return [
        [
          `type=${element.type}`,
          `component=${component}`,
          `text=${JSON.stringify(text)}`,
          `at=${formatPoint(anchorPosition, context.origin)}`,
          `layer=${formatLayer(element.layer)}`,
          `font=${JSON.stringify(asString(element.font) ?? "")}`,
          `size=${formatNumber(fontSize)}`,
          `rotation=${formatNumber(
            asNumber(element.ccw_rotation) ?? asNumber(element.rotation) ?? 0,
          )}`,
          `alignment=${JSON.stringify(
            asString(element.anchor_alignment) ?? "",
          )}`,
          `mirrored=${String(element.is_mirrored === true)}`,
          `color=${JSON.stringify(asString(element.color) ?? "")}`,
        ].join("|"),
      ]
    })
    .sort()
}

function getKeepoutSignatures({
  circuitJson,
  context,
}: {
  circuitJson: CircuitElement[]
  context: PcbSemanticContext
}): string[] {
  return circuitJson
    .flatMap((element) => {
      if (element.type !== "pcb_keepout") return []
      const center = asPoint(element.center)
      if (!center) return []
      return [
        [
          `shape=${asString(element.shape) ?? ""}`,
          `at=${formatPoint(center, context.origin)}`,
          `width=${formatNumber(asNumber(element.width))}`,
          `height=${formatNumber(asNumber(element.height))}`,
          `radius=${formatNumber(asNumber(element.radius))}`,
          `layers=${JSON.stringify(asStrings(element.layers).sort())}`,
        ].join("|"),
      ]
    })
    .sort()
}

export function getPcbSemanticSignatures(
  circuitJson: CircuitElement[],
): PcbSemanticSignatures {
  const context = getPcbSemanticContext(circuitJson)
  return {
    annotationPathSegments: getComponentOwnedPathSegmentSignatures({
      circuitJson,
      context,
      deduplicate: true,
      elementTypes: new Set([
        "pcb_courtyard_outline",
        "pcb_fabrication_note_path",
        "pcb_note_path",
      ]),
    }),
    annotationTexts: getTextSignatures({
      circuitJson,
      context,
      elementTypes: new Set(["pcb_fabrication_note_text", "pcb_note_text"]),
    }),
    boardOutlineSegments: getBoardOutlineSegmentSignatures({
      circuitJson,
      context,
    }),
    copperPourSegments: getCopperPourSegmentSignatures({
      circuitJson,
      context,
    }),
    copperTraceSegments: getCopperTraceSegmentSignatures({
      circuitJson,
      context,
    }),
    keepouts: getKeepoutSignatures({ circuitJson, context }),
    silkscreenPathSegments: getComponentOwnedPathSegmentSignatures({
      circuitJson,
      context,
      deduplicate: false,
      elementTypes: new Set(["pcb_silkscreen_path"]),
    }),
    silkscreenTexts: getTextSignatures({
      circuitJson,
      context,
      elementTypes: new Set(["pcb_silkscreen_text"]),
    }),
    sourceConnectivity: getSourceConnectivitySignatures({
      circuitJson,
      context,
    }),
    vias: getViaSignatures({ circuitJson, context }),
  }
}

export function getPcbSemanticMismatches({
  roundTripCircuitJson,
  sourceCircuitJson,
}: {
  roundTripCircuitJson: CircuitElement[]
  sourceCircuitJson: CircuitElement[]
}): string[] {
  const sourceSignatures = getPcbSemanticSignatures(sourceCircuitJson)
  const roundTripSignatures = getPcbSemanticSignatures(roundTripCircuitJson)
  return (Object.keys(sourceSignatures) as Array<keyof PcbSemanticSignatures>)
    .flatMap((category) =>
      getSemanticSignatureMismatches({
        category,
        roundTripSignatures: roundTripSignatures[category],
        sourceSignatures: sourceSignatures[category],
      }),
    )
    .slice(0, 20)
}
