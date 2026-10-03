import { convertCircuitPcbCcwRotationDegreesToAltium } from "./convert-circuit-pcb-ccw-rotation-degrees-to-altium"
import { createCircuitToAltiumPcbPointTransform } from "./create-circuit-to-altium-pcb-point-transform"
import { createPcbBoardLayerStackFields } from "./create-pcb-board-layer-stack-fields"
import { createPcbComponentBodyRecords } from "./create-pcb-component-body-records"
import { createPcbCopperPourRecords } from "./create-pcb-copper-pour-records"
import { createPcbCourtyardRecords } from "./create-pcb-courtyard-records"
import { createPcbCutoutRecords } from "./create-pcb-cutout-records"
import { createPcbDocumentationRecords } from "./create-pcb-documentation-records"
import { createPcbKeepoutRecords } from "./create-pcb-keepout-records"
import { createPcbNetEntries, type PcbNetEntry } from "./create-pcb-net-entries"
import { createPcbSilkscreenGraphicRecords } from "./create-pcb-silkscreen-graphic-records"
import { createPcbSilkscreenLineRecords } from "./create-pcb-silkscreen-line-records"
import { createPcbSilkscreenTextRecord } from "./create-pcb-silkscreen-text-record"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  formatMil,
  formatNumber,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
  pointsEqual,
  sanitizeField,
} from "./format"
import { createAltiumFootprintNameLookup } from "./get-altium-footprint-name"
import { getBoardOutline } from "./get-board-outline"
import type {
  CircuitElement,
  PcbComponentId,
  PcbPortId,
  PcbTraceId,
  SourceComponentId,
  SourcePortId,
  SourceTraceId,
} from "./types"

type PadLookupContext = {
  netBySourcePortId: Map<SourcePortId, PcbNetEntry>
  pcbComponents: Map<PcbComponentId, CircuitElement>
  pcbPorts: Map<PcbPortId, CircuitElement>
  sourcePorts: Map<SourcePortId, CircuitElement>
}

/**
 * Source port for a pad. Pads without a pcb_port_id (for example plated shell
 * holes of imported footprints) are matched through their port_hints against
 * the owning component's source ports, as tscircuit itself matches them.
 */
function getPadSourcePort(
  pad: CircuitElement,
  context: PadLookupContext,
): CircuitElement | undefined {
  const pcbPort = context.pcbPorts.get(asString(pad.pcb_port_id))
  const sourcePort = context.sourcePorts.get(asString(pcbPort?.source_port_id))
  if (sourcePort || !Array.isArray(pad.port_hints)) return sourcePort
  const sourceComponentId = asString(
    context.pcbComponents.get(asString(pad.pcb_component_id))
      ?.source_component_id,
  )
  if (!sourceComponentId) return undefined
  const hints = new Set(pad.port_hints.map((hint) => asString(hint)))
  for (const candidate of context.sourcePorts.values()) {
    if (asString(candidate.source_component_id) !== sourceComponentId) continue
    const pinNumber = candidate.pin_number?.toString()
    if (
      hints.has(asString(candidate.name)) ||
      (pinNumber !== undefined &&
        (hints.has(pinNumber) || hints.has(`pin${pinNumber}`)))
    ) {
      return candidate
    }
  }
  return undefined
}

function getPadNet(
  pad: CircuitElement,
  context: PadLookupContext,
): PcbNetEntry | undefined {
  const sourcePort = getPadSourcePort(pad, context)
  return context.netBySourcePortId.get(asString(sourcePort?.source_port_id))
}

function getPadName(pad: CircuitElement, context: PadLookupContext): string {
  const sourcePort = getPadSourcePort(pad, context)
  return (
    sanitizeField(sourcePort?.pin_number?.toString()) ||
    sanitizeField(sourcePort?.name) ||
    "1"
  )
}

function getSmtPadShapeFields({
  pad,
  width,
  height,
  layer,
}: {
  pad: CircuitElement
  width: number
  height: number
  layer: "TOP" | "BOTTOM"
}): string[] {
  const shape = asString(pad.shape).toLowerCase()
  if (shape === "circle") return ["SHAPE=ROUND"]

  const isPill = shape === "pill" || shape === "rotated_pill"
  const requestedCornerRadius = isPill
    ? asPositiveNumber(pad.radius, Math.min(width, height) / 2)
    : Math.max(0, asNumber(pad.corner_radius ?? pad.rect_border_radius))
  const cornerRadius = Math.min(
    Math.min(width, height) / 2,
    requestedCornerRadius,
  )
  if (cornerRadius <= 0) return ["SHAPE=RECTANGLE"]

  const layerOrdinal = layer === "BOTTOM" ? 31 : 0
  const cornerRadiusPercent = (cornerRadius * 200) / Math.min(width, height)
  return [
    "SHAPE=RECTANGLE",
    `LAYER${layerOrdinal}ALTSHAPE=ROUNDRECT`,
    `LAYER${layerOrdinal}CORNERRADIUS=${formatNumber(cornerRadiusPercent)}`,
  ]
}

export const createPcbDocument = (circuitJson: CircuitElement[]): string => {
  const board = byType(circuitJson, "pcb_board")[0]
  const outline = getBoardOutline(board)
  const circuitToAltiumPcbPoint =
    createCircuitToAltiumPcbPointTransform(outline)
  const firstOutlinePoint = outline[0] ?? { x: 0, y: 0 }
  const closedOutline = [...outline, firstOutlinePoint]
  const boardFields = closedOutline.flatMap((point, index) => {
    const altiumPoint = circuitToAltiumPcbPoint(point)
    return [
      `KIND${index}=0`,
      `VX${index}=${formatMil(altiumPoint.x)}`,
      `VY${index}=${formatMil(altiumPoint.y)}`,
    ]
  })
  const lines = [
    [
      "|RECORD=Board",
      "KIND=Protel_Advanced_PCB",
      "VERSION=5.00",
      ...boardFields,
      ...createPcbBoardLayerStackFields(),
    ].join("|"),
  ]

  const sourceComponents = new Map<SourceComponentId, CircuitElement>(
    byType(circuitJson, "source_component")
      .filter((element) => typeof element.source_component_id === "string")
      .map((element) => [asString(element.source_component_id), element]),
  )
  const sourcePorts = new Map<SourcePortId, CircuitElement>(
    byType(circuitJson, "source_port").map((port) => [
      asString(port.source_port_id),
      port,
    ]),
  )
  const pcbPorts = new Map<PcbPortId, CircuitElement>(
    byType(circuitJson, "pcb_port").map((port) => [
      asString(port.pcb_port_id),
      port,
    ]),
  )
  const netEntries = createPcbNetEntries(circuitJson)
  const netByTraceId = new Map<SourceTraceId, PcbNetEntry>(
    netEntries.flatMap((net) =>
      net.traceIds.map((traceId) => [traceId, net] as const),
    ),
  )
  const netBySourcePortId = new Map<SourcePortId, PcbNetEntry>(
    netEntries.flatMap((net) =>
      net.sourcePortIds.map((sourcePortId) => [sourcePortId, net] as const),
    ),
  )
  const pcbComponents = byType(circuitJson, "pcb_component")
  const componentIndex = new Map<PcbComponentId, number>(
    pcbComponents.map((component, index) => [
      asString(component.pcb_component_id) || `pcb_component_${index}`,
      index,
    ]),
  )

  for (const net of netEntries) {
    lines.push(
      `|RECORD=Net|ID=${net.index}|NAME=${sanitizeField(net.name)}|VISIBLE=FALSE|JUMPERSVISIBLE=FALSE`,
    )
  }

  lines.push(
    ...createPcbCutoutRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
    }),
  )

  lines.push(
    ...createPcbCopperPourRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
      netEntries,
    }),
  )

  const getFootprintName = createAltiumFootprintNameLookup(circuitJson)
  const silkscreenTexts = byType(circuitJson, "pcb_silkscreen_text")
  // Altium shows a component's designator from its owned Text primitive
  // flagged DESIGNATOR=TRUE (and its comment from COMMENT=TRUE). Without
  // them Altium invents "Designator1"/"Comment" on load, so mark the
  // reference-designator silkscreen text, or add a hidden one.
  const designatorTexts = new Set<CircuitElement>()
  const designatorRecords: string[] = []
  for (const [index, component] of pcbComponents.entries()) {
    const componentId =
      asString(component.pcb_component_id) || `pcb_component_${index}`
    const sourceComponent = sourceComponents.get(
      asString(component.source_component_id),
    )
    const altiumCenter = circuitToAltiumPcbPoint(
      asPoint(component.center) ?? { x: 0, y: 0 },
    )
    const designator =
      sanitizeField(sourceComponent?.name) || `Component-${index + 1}`
    const pattern = getFootprintName(component)
    const componentLayer =
      asString(component.layer).toLowerCase() === "bottom" ? "BOTTOM" : "TOP"
    const overlayLayer =
      componentLayer === "BOTTOM" ? "BOTTOMOVERLAY" : "TOPOVERLAY"
    const designatorText = silkscreenTexts.find(
      (text) =>
        asString(text.pcb_component_id) === componentId &&
        sanitizeField(text.text) === designator,
    )
    if (designatorText) designatorTexts.add(designatorText)
    const comment =
      sanitizeField(sourceComponent?.display_value) ||
      sanitizeField(sourceComponent?.manufacturer_part_number) ||
      designator
    const hiddenTextFields = (text: string, flag: "DESIGNATOR" | "COMMENT") =>
      [
        "|RECORD=Text",
        `COMPONENT=${index}`,
        `LAYER=${overlayLayer}`,
        `X=${formatMil(altiumCenter.x)}`,
        `Y=${formatMil(altiumCenter.y)}`,
        "ROTATION=0",
        `MIRROR=${componentLayer === "BOTTOM" ? "TRUE" : "FALSE"}`,
        "HEIGHT=40mil",
        "WIDTH=6mil",
        "USETTFONTS=TRUE",
        "FONTNAME=Arial",
        "JUSTIFICATION=5",
        `WIDESTRING=${[...text].map((c) => c.codePointAt(0)).join(",")}`,
        `${flag}=TRUE`,
      ].join("|")
    if (!designatorText) {
      designatorRecords.push(hiddenTextFields(designator, "DESIGNATOR"))
    }
    designatorRecords.push(hiddenTextFields(comment, "COMMENT"))
    lines.push(
      [
        "|RECORD=Component",
        `ID=${index}`,
        `LAYER=${componentLayer}`,
        `X=${formatMil(altiumCenter.x)}`,
        `Y=${formatMil(altiumCenter.y)}`,
        `ROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(asNumber(component.rotation)))}`,
        `PATTERN=${pattern}`,
        `SOURCEDESIGNATOR=${designator}`,
        `NAMEON=${designatorText ? "TRUE" : "FALSE"}`,
        "COMMENTON=FALSE",
        `SOURCEUNIQUEID=${sanitizeField(componentId)}`,
      ].join("|"),
    )
  }

  lines.push(
    ...createPcbComponentBodyRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
  )

  lines.push(
    ...createPcbKeepoutRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
    }),
    ...createPcbCourtyardRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
    ...createPcbDocumentationRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
  )

  const padLookupContext: PadLookupContext = {
    netBySourcePortId,
    pcbComponents: new Map(
      pcbComponents.map((component) => [
        asString(component.pcb_component_id),
        component,
      ]),
    ),
    pcbPorts,
    sourcePorts,
  }

  for (const pad of byType(circuitJson, "pcb_smtpad")) {
    const altiumCenter = circuitToAltiumPcbPoint({
      x: asNumber(pad.x),
      y: asNumber(pad.y),
    })
    const altiumComponentIndex = componentIndex.get(
      asString(pad.pcb_component_id),
    )
    const net = getPadNet(pad, padLookupContext)
    const diameter = asPositiveNumber(pad.radius, 0.5) * 2
    const width = asPositiveNumber(pad.width, diameter)
    const height = asPositiveNumber(pad.height, width)
    const layer =
      asString(pad.layer).toLowerCase() === "bottom" ? "BOTTOM" : "TOP"
    lines.push(
      [
        "|RECORD=Pad",
        ...(altiumComponentIndex === undefined
          ? []
          : [`COMPONENT=${altiumComponentIndex}`]),
        ...(net ? [`NET=${net.index}`] : []),
        `LAYER=${layer}`,
        `ROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(asNumber(pad.ccw_rotation)))}`,
        `NAME=${getPadName(pad, padLookupContext)}`,
        "HOLESIZE=0mil",
        "PLATED=TRUE",
        "LOCKED=FALSE",
        `X=${formatMil(altiumCenter.x)}`,
        `Y=${formatMil(altiumCenter.y)}`,
        ...getSmtPadShapeFields({ pad, width, height, layer }),
        `XSIZE=${formatMil(width * MILLIMETERS_TO_MILS)}`,
        `YSIZE=${formatMil(height * MILLIMETERS_TO_MILS)}`,
      ].join("|"),
    )
  }

  for (const hole of byType(circuitJson, "pcb_plated_hole")) {
    const altiumCenter = circuitToAltiumPcbPoint({
      x: asNumber(hole.x),
      y: asNumber(hole.y),
    })
    const altiumComponentIndex = componentIndex.get(
      asString(hole.pcb_component_id),
    )
    const net = getPadNet(hole, padLookupContext)
    const hasIndependentPadRotation =
      hole.shape === "rotated_pill_hole_with_rect_pad"
    const outerWidth = asPositiveNumber(
      hasIndependentPadRotation ? hole.rect_pad_width : hole.outer_width,
      asPositiveNumber(hole.outer_diameter, 1.6),
    )
    const outerHeight = asPositiveNumber(
      hasIndependentPadRotation ? hole.rect_pad_height : hole.outer_height,
      outerWidth,
    )
    const holeWidth = asPositiveNumber(
      hole.hole_width,
      asPositiveNumber(hole.hole_diameter, 0.8),
    )
    const holeHeight = asPositiveNumber(hole.hole_height, holeWidth)
    const isSlotted = Math.abs(holeWidth - holeHeight) > 1e-9
    const holeCcwRotationDegrees = asNumber(
      hasIndependentPadRotation ? hole.hole_ccw_rotation : hole.ccw_rotation,
    )
    const padCcwRotationDegrees = asNumber(
      hasIndependentPadRotation ? hole.rect_ccw_rotation : hole.ccw_rotation,
    )
    const isRoundedRectPad =
      hasIndependentPadRotation &&
      asPositiveNumber(hole.rect_border_radius, 0) >=
        Math.min(outerWidth, outerHeight) / 2 - 1e-9
    lines.push(
      [
        "|RECORD=Pad",
        ...(altiumComponentIndex === undefined
          ? []
          : [`COMPONENT=${altiumComponentIndex}`]),
        ...(net ? [`NET=${net.index}`] : []),
        "LAYER=MULTILAYER",
        `ROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(padCcwRotationDegrees))}`,
        `NAME=${getPadName(hole, padLookupContext)}`,
        `HOLESIZE=${formatMil(Math.min(holeWidth, holeHeight) * MILLIMETERS_TO_MILS)}`,
        `HOLEWIDTH=${formatMil(Math.max(holeWidth, holeHeight) * MILLIMETERS_TO_MILS)}`,
        `HOLESHAPE=${isSlotted ? "SLOT" : "ROUND"}`,
        `HOLEROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(holeCcwRotationDegrees))}`,
        "PLATED=TRUE",
        "LOCKED=FALSE",
        `X=${formatMil(altiumCenter.x)}`,
        `Y=${formatMil(altiumCenter.y)}`,
        `SHAPE=${hole.shape === "circle" || hole.shape === "oval" || hole.shape === "pill" || isRoundedRectPad ? "ROUND" : "RECTANGLE"}`,
        `XSIZE=${formatMil(outerWidth * MILLIMETERS_TO_MILS)}`,
        `YSIZE=${formatMil(outerHeight * MILLIMETERS_TO_MILS)}`,
      ].join("|"),
    )
  }

  for (const [holeIndex, hole] of byType(circuitJson, "pcb_hole").entries()) {
    const altiumCenter = circuitToAltiumPcbPoint({
      x: asNumber(hole.x),
      y: asNumber(hole.y),
    })
    const altiumComponentIndex = componentIndex.get(
      asString(hole.pcb_component_id),
    )
    const diameter = asPositiveNumber(hole.hole_diameter, 1)
    const holeWidth = asPositiveNumber(hole.hole_width, diameter)
    const holeHeight = asPositiveNumber(hole.hole_height, diameter)
    const isSlotted = Math.abs(holeWidth - holeHeight) > 1e-9
    lines.push(
      [
        "|RECORD=Pad",
        ...(altiumComponentIndex === undefined
          ? []
          : [`COMPONENT=${altiumComponentIndex}`]),
        "LAYER=MULTILAYER",
        `ROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(asNumber(hole.ccw_rotation)))}`,
        `NAME=NPTH-${holeIndex + 1}`,
        `HOLESIZE=${formatMil(Math.min(holeWidth, holeHeight) * MILLIMETERS_TO_MILS)}`,
        `HOLEWIDTH=${formatMil(Math.max(holeWidth, holeHeight) * MILLIMETERS_TO_MILS)}`,
        `HOLESHAPE=${isSlotted ? "SLOT" : "ROUND"}`,
        `HOLEROTATION=${formatNumber(convertCircuitPcbCcwRotationDegreesToAltium(asNumber(hole.ccw_rotation)))}`,
        "PLATED=FALSE",
        "LOCKED=FALSE",
        `X=${formatMil(altiumCenter.x)}`,
        `Y=${formatMil(altiumCenter.y)}`,
        `SHAPE=${isSlotted ? "RECTANGLE" : "ROUND"}`,
        `XSIZE=${formatMil(holeWidth * MILLIMETERS_TO_MILS)}`,
        `YSIZE=${formatMil(holeHeight * MILLIMETERS_TO_MILS)}`,
      ].join("|"),
    )
  }

  for (const trace of byType(circuitJson, "pcb_trace")) {
    const route = Array.isArray(trace.route)
      ? trace.route.flatMap((routePoint) =>
          isCircuitElement(routePoint) && asPoint(routePoint)
            ? [routePoint]
            : [],
        )
      : []
    const net = netByTraceId.get(asString(trace.source_trace_id))
    for (let index = 1; index < route.length; index++) {
      const circuitRouteStart = route[index - 1]
      const circuitRouteEnd = route[index]
      if (!circuitRouteStart || !circuitRouteEnd) continue
      if (
        circuitRouteStart.route_type === "via" &&
        circuitRouteEnd.route_type === "via"
      ) {
        continue
      }
      const altiumStartPoint = circuitToAltiumPcbPoint({
        x: asNumber(circuitRouteStart.x),
        y: asNumber(circuitRouteStart.y),
      })
      const altiumEndPoint = circuitToAltiumPcbPoint({
        x: asNumber(circuitRouteEnd.x),
        y: asNumber(circuitRouteEnd.y),
      })
      if (pointsEqual(altiumStartPoint, altiumEndPoint)) continue
      const routeLayer =
        asString(
          circuitRouteEnd.layer,
          asString(circuitRouteStart.layer),
        ).toLowerCase() === "bottom"
          ? "BOTTOM"
          : "TOP"
      lines.push(
        [
          "|RECORD=Track",
          ...(net ? [`NET=${net.index}`] : []),
          `LAYER=${routeLayer}`,
          "LOCKED=FALSE",
          `X1=${formatMil(altiumStartPoint.x)}`,
          `Y1=${formatMil(altiumStartPoint.y)}`,
          `X2=${formatMil(altiumEndPoint.x)}`,
          `Y2=${formatMil(altiumEndPoint.y)}`,
          `WIDTH=${formatMil(asPositiveNumber(circuitRouteEnd.width, asPositiveNumber(circuitRouteStart.width, 0.2)) * MILLIMETERS_TO_MILS)}`,
        ].join("|"),
      )
    }
  }

  const pcbTraces = new Map<PcbTraceId, CircuitElement>(
    byType(circuitJson, "pcb_trace").map((trace) => [
      asString(trace.pcb_trace_id),
      trace,
    ]),
  )
  for (const via of byType(circuitJson, "pcb_via")) {
    const altiumCenter = circuitToAltiumPcbPoint({
      x: asNumber(via.x),
      y: asNumber(via.y),
    })
    const owningTrace = pcbTraces.get(asString(via.pcb_trace_id))
    const net = netByTraceId.get(
      asString(via.source_trace_id, asString(owningTrace?.source_trace_id)),
    )
    lines.push(
      [
        "|RECORD=Via",
        ...(net ? [`NET=${net.index}`] : []),
        `X=${formatMil(altiumCenter.x)}`,
        `Y=${formatMil(altiumCenter.y)}`,
        `DIAMETER=${formatMil(asPositiveNumber(via.outer_diameter, 0.6) * MILLIMETERS_TO_MILS)}`,
        `HOLESIZE=${formatMil(asPositiveNumber(via.hole_diameter, 0.3) * MILLIMETERS_TO_MILS)}`,
        "STARTLAYER=TOP",
        "STOPLAYER=BOTTOM",
        "LOCKED=FALSE",
      ].join("|"),
    )
  }

  lines.push(
    ...createPcbSilkscreenLineRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
  )

  for (const silkscreenPath of byType(circuitJson, "pcb_silkscreen_path")) {
    const route = Array.isArray(silkscreenPath.route)
      ? silkscreenPath.route.flatMap((routePoint) =>
          isCircuitElement(routePoint) && asPoint(routePoint)
            ? [routePoint]
            : [],
        )
      : []
    const altiumComponentIndex = componentIndex.get(
      asString(silkscreenPath.pcb_component_id),
    )
    const silkscreenLayer =
      asString(silkscreenPath.layer).toLowerCase() === "bottom"
        ? "BOTTOMOVERLAY"
        : "TOPOVERLAY"
    for (let index = 1; index < route.length; index++) {
      const circuitStartPoint = asPoint(route[index - 1])
      const circuitEndPoint = asPoint(route[index])
      if (!circuitStartPoint || !circuitEndPoint) continue
      const altiumStartPoint = circuitToAltiumPcbPoint(circuitStartPoint)
      const altiumEndPoint = circuitToAltiumPcbPoint(circuitEndPoint)
      if (pointsEqual(altiumStartPoint, altiumEndPoint)) continue
      lines.push(
        [
          "|RECORD=Track",
          ...(altiumComponentIndex === undefined
            ? []
            : [`COMPONENT=${altiumComponentIndex}`]),
          `LAYER=${silkscreenLayer}`,
          "LOCKED=FALSE",
          `X1=${formatMil(altiumStartPoint.x)}`,
          `Y1=${formatMil(altiumStartPoint.y)}`,
          `X2=${formatMil(altiumEndPoint.x)}`,
          `Y2=${formatMil(altiumEndPoint.y)}`,
          `WIDTH=${formatMil(asPositiveNumber(silkscreenPath.stroke_width, 0.15) * MILLIMETERS_TO_MILS)}`,
        ].join("|"),
      )
    }
  }

  lines.push(
    ...createPcbSilkscreenGraphicRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
  )

  for (const silkscreenText of silkscreenTexts) {
    const record = createPcbSilkscreenTextRecord({
      altiumComponentIndex: componentIndex.get(
        asString(silkscreenText.pcb_component_id),
      ),
      circuitToAltiumPcbPoint,
      silkscreenText,
    })
    lines.push(
      designatorTexts.has(silkscreenText)
        ? `${record}|DESIGNATOR=TRUE`
        : record,
    )
  }
  lines.push(...designatorRecords)

  return `${lines.join("\r\n")}\r\n`
}
