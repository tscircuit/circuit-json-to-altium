import { asNumber, asPoint, asString, isCircuitElement } from "../../lib/format"
import type { CircuitElement, Point, SourcePortId } from "../../lib/types"

const preservedElementTypes = [
  "source_component",
  "source_port",
  "source_net",
  "schematic_component",
  "schematic_port",
  "schematic_net_label",
  "schematic_path",
  "schematic_rect",
  "schematic_text",
] as const

const schematicSymbolPrimitiveTypes = [
  "schematic_arc",
  "schematic_circle",
  "schematic_line",
  "schematic_path",
  "schematic_rect",
] as const

type PreservedElementType = (typeof preservedElementTypes)[number]
type SchematicSymbolPrimitiveType =
  (typeof schematicSymbolPrimitiveTypes)[number]

type CircuitSize = {
  height: number
  width: number
}

function roundToAltiumSchematicGrid(coordinate: number): number {
  return Math.round(coordinate * 20) / 20
}

export type SchematicPrimitiveCounts = Record<PreservedElementType, number> & {
  do_not_connect: number
  junction: number
  off_sheet_port: number
  power_port: number
  wire_segment: number
}

export type SchematicSymbolPrimitiveCounts = Record<
  SchematicSymbolPrimitiveType,
  number
> & {
  filled_path: number
  total: number
}

export type SchematicOffSheetPortSignature = {
  facingDirection: string
  hasInputArrow: boolean
  hasOutputArrow: boolean
  name: string
}

export type SchematicAnnotationSignature =
  | {
      anchor: string
      color: string
      fontSizeCircuitUnits: number
      rotationDegrees: number
      text: string
      type: "schematic_text"
    }
  | {
      color: string
      fillColor: string
      isFilled: boolean
      strokeWidthCircuitUnits: number
      type: "schematic_rect"
    }
  | {
      fillColor: string
      isFilled: boolean
      pointCount: number
      strokeColor: string
      strokeWidthCircuitUnits: number
      type: "schematic_path"
    }

export type SchematicComponentTextSignature = {
  anchor: string
  color: string
  fontSizeCircuitUnits: number
  positionRelativeToFirstText: Point
  rotationDegrees: number
  text: string
}

export type SchematicSheetSignature = {
  centerRelativeToFirstSheet: Point
  entryNames: string[]
  name: string
  size: CircuitSize
}

export type SchematicComponentPartSignature = {
  manufacturerPartNumber: string
  name: string
  supplierPartNumbers: Array<[string, string[]]>
}

export type SchematicRoundTripMetrics = {
  componentSizeMaxDeltaCircuitUnits: number
  geometryMaxDeltaCircuitUnits: number
  roundTripAnnotationSignatures: SchematicAnnotationSignature[]
  roundTripComponentTextSignatures: SchematicComponentTextSignature[]
  roundTripSymbolPrimitiveCounts: SchematicSymbolPrimitiveCounts
  roundTripComponentNames: string[]
  roundTripComponentPartSignatures: SchematicComponentPartSignature[]
  roundTripCounts: SchematicPrimitiveCounts
  roundTripNetLabelTexts: string[]
  roundTripOffSheetPortSignatures: SchematicOffSheetPortSignature[]
  roundTripPowerPortSymbolNames: string[]
  roundTripSheetSignatures: SchematicSheetSignature[]
  roundTripPortNames: string[]
  sourceComponentNames: string[]
  sourceComponentPartSignatures: SchematicComponentPartSignature[]
  sourceSymbolPrimitiveCounts: SchematicSymbolPrimitiveCounts
  sourceAnnotationSignatures: SchematicAnnotationSignature[]
  sourceComponentTextSignatures: SchematicComponentTextSignature[]
  sourceCounts: SchematicPrimitiveCounts
  sourceNetLabelTexts: string[]
  sourceOffSheetPortSignatures: SchematicOffSheetPortSignature[]
  sourcePowerPortSymbolNames: string[]
  sourceSheetSignatures: SchematicSheetSignature[]
  sourcePortNames: string[]
  sourceSupportedPrimitiveTotal: number
}

function getComponentPartSignatures(
  circuitJson: CircuitElement[],
): SchematicComponentPartSignature[] {
  return circuitJson
    .filter(
      (element) =>
        element.type === "source_component" &&
        (asString(element.manufacturer_part_number) !== "" ||
          isCircuitElement(element.supplier_part_numbers)),
    )
    .map((component) => ({
      manufacturerPartNumber: asString(component.manufacturer_part_number),
      name: asString(component.name),
      supplierPartNumbers: isCircuitElement(component.supplier_part_numbers)
        ? Object.entries(component.supplier_part_numbers)
            .flatMap(([supplierName, partNumbers]) =>
              Array.isArray(partNumbers)
                ? [
                    [
                      supplierName,
                      partNumbers
                        .map((partNumber) => asString(partNumber))
                        .sort(),
                    ] as [string, string[]],
                  ]
                : [],
            )
            .sort(([firstName], [secondName]) =>
              firstName.localeCompare(secondName),
            )
        : [],
    }))
}

function getSchematicSheetSignatures(
  circuitJson: CircuitElement[],
): SchematicSheetSignature[] {
  const sourcePortNames = new Map(
    circuitJson
      .filter((element) => element.type === "source_port")
      .map((sourcePort) => [
        asString(sourcePort.source_port_id),
        asString(sourcePort.name),
      ]),
  )
  const sheets = circuitJson.filter(
    (element) => element.type === "schematic_sheet",
  )
  const schematicComponentBySubcircuitId = new Map(
    circuitJson
      .filter(
        (element) =>
          element.type === "schematic_component" &&
          element.is_schematic_group === true &&
          asString(element.subcircuit_id),
      )
      .map((component) => [asString(component.subcircuit_id), component]),
  )
  const firstSheetComponent = schematicComponentBySubcircuitId.get(
    asString(sheets[0]?.subcircuit_id),
  )
  const firstSheetCenter = asPoint(firstSheetComponent?.center) ?? {
    x: 0,
    y: 0,
  }
  return sheets.map((sheet) => {
    const schematicComponent = schematicComponentBySubcircuitId.get(
      asString(sheet.subcircuit_id),
    )
    const center = asPoint(schematicComponent?.center) ?? { x: 0, y: 0 }
    const size = isCircuitElement(schematicComponent?.size)
      ? schematicComponent.size
      : {}
    return {
      centerRelativeToFirstSheet: {
        x: roundToAltiumSchematicGrid(center.x - firstSheetCenter.x),
        y: roundToAltiumSchematicGrid(center.y - firstSheetCenter.y),
      },
      entryNames: circuitJson.flatMap((schematicPort) =>
        schematicPort.type === "schematic_port" &&
        asString(schematicPort.schematic_sheet_id) ===
          asString(sheet.schematic_sheet_id) &&
        !asString(schematicPort.schematic_component_id)
          ? [
              asString(schematicPort.display_pin_label) ||
                sourcePortNames.get(asString(schematicPort.source_port_id)) ||
                "",
            ]
          : [],
      ),
      name: asString(sheet.name),
      size: {
        height: asNumber(size.height),
        width: asNumber(size.width),
      },
    }
  })
}

function getSchematicComponentTextSignatures(
  circuitJson: CircuitElement[],
): SchematicComponentTextSignature[] {
  const componentTexts = circuitJson.filter(
    (element) =>
      element.type === "schematic_text" &&
      Boolean(asString(element.schematic_component_id)),
  )
  const firstTextPosition = asPoint(componentTexts[0]?.position) ?? {
    x: 0,
    y: 0,
  }
  return componentTexts.map((element) => {
    const position = asPoint(element.position) ?? { x: 0, y: 0 }
    return {
      anchor: asString(element.anchor),
      color: asString(element.color),
      fontSizeCircuitUnits: asNumber(element.font_size),
      positionRelativeToFirstText: {
        x: roundToAltiumSchematicGrid(
          roundToAltiumSchematicGrid(position.x) -
            roundToAltiumSchematicGrid(firstTextPosition.x),
        ),
        y: roundToAltiumSchematicGrid(
          roundToAltiumSchematicGrid(position.y) -
            roundToAltiumSchematicGrid(firstTextPosition.y),
        ),
      },
      rotationDegrees: asNumber(element.rotation),
      text: asString(element.text),
    }
  })
}

function getOffSheetPortSignatures(
  circuitJson: CircuitElement[],
): SchematicOffSheetPortSignature[] {
  const sourcePortsById = new Map<SourcePortId, CircuitElement>(
    circuitJson
      .filter((element) => element.type === "source_port")
      .map((sourcePort) => [asString(sourcePort.source_port_id), sourcePort]),
  )
  return circuitJson.flatMap((schematicPort) => {
    if (
      schematicPort.type !== "schematic_port" ||
      asString(schematicPort.schematic_component_id)
    ) {
      return []
    }
    const sourcePort = sourcePortsById.get(
      asString(schematicPort.source_port_id),
    )
    const isStandaloneNoConnectMarker =
      !asString(schematicPort.schematic_sheet_id) &&
      schematicPort.is_internal_circuit_port !== true &&
      sourcePort?.do_not_connect === true
    if (isStandaloneNoConnectMarker) return []
    return [
      {
        facingDirection: asString(schematicPort.facing_direction),
        hasInputArrow: schematicPort.has_input_arrow === true,
        hasOutputArrow: schematicPort.has_output_arrow === true,
        name:
          asString(schematicPort.display_pin_label) ||
          asString(sourcePort?.name),
      },
    ]
  })
}

function getPowerPortSymbolNames(circuitJson: CircuitElement[]): string[] {
  return circuitJson.flatMap((element) => {
    if (element.type !== "schematic_net_label") return []
    const symbolName = asString(element.symbol_name)
    return symbolName.startsWith("rail_") || symbolName.startsWith("ground_")
      ? [symbolName]
      : []
  })
}

function countSchematicPrimitives(
  circuitJson: CircuitElement[],
): SchematicPrimitiveCounts {
  const getElementCount = (type: PreservedElementType): number =>
    circuitJson.filter(
      (element) =>
        element.type === type &&
        ((type !== "schematic_path" && type !== "schematic_rect") ||
          (!asString(element.schematic_component_id) &&
            !asString(element.schematic_symbol_id))),
    ).length
  let junctionCount = 0
  let wireSegmentCount = 0
  for (const element of circuitJson) {
    if (element.type !== "schematic_trace") continue
    junctionCount += Array.isArray(element.junctions)
      ? element.junctions.length
      : 0
    wireSegmentCount += Array.isArray(element.edges) ? element.edges.length : 0
  }
  return {
    do_not_connect: circuitJson.filter(
      (element) =>
        element.type === "source_port" && element.do_not_connect === true,
    ).length,
    junction: junctionCount,
    off_sheet_port: getOffSheetPortSignatures(circuitJson).length,
    power_port: getPowerPortSymbolNames(circuitJson).length,
    schematic_component: getElementCount("schematic_component"),
    schematic_net_label: getElementCount("schematic_net_label"),
    schematic_path: getElementCount("schematic_path"),
    schematic_port: getElementCount("schematic_port"),
    schematic_rect: getElementCount("schematic_rect"),
    schematic_text: getElementCount("schematic_text"),
    source_component: getElementCount("source_component"),
    source_net: getElementCount("source_net"),
    source_port: getElementCount("source_port"),
    wire_segment: wireSegmentCount,
  }
}

function getSchematicSymbolPrimitiveCounts(
  circuitJson: CircuitElement[],
): SchematicSymbolPrimitiveCounts {
  const counts = Object.fromEntries(
    schematicSymbolPrimitiveTypes.map((type) => [
      type,
      circuitJson.filter(
        (element) =>
          element.type === type && asString(element.schematic_symbol_id) !== "",
      ).length,
    ]),
  ) as Record<SchematicSymbolPrimitiveType, number>
  return {
    ...counts,
    filled_path: circuitJson.filter(
      (element) =>
        element.type === "schematic_path" &&
        asString(element.schematic_symbol_id) !== "" &&
        element.is_filled === true,
    ).length,
    total: Object.values(counts).reduce((total, count) => total + count, 0),
  }
}

function getSchematicAnnotationSignatures(
  circuitJson: CircuitElement[],
): SchematicAnnotationSignature[] {
  const signatures: SchematicAnnotationSignature[] = []
  for (const element of circuitJson) {
    if (
      asString(element.schematic_component_id) ||
      asString(element.schematic_symbol_id)
    ) {
      continue
    }
    if (element.type === "schematic_text") {
      signatures.push({
        anchor: asString(element.anchor),
        color: asString(element.color),
        fontSizeCircuitUnits: asNumber(element.font_size),
        rotationDegrees: asNumber(element.rotation),
        text: asString(element.text),
        type: element.type,
      })
      continue
    }
    if (element.type === "schematic_rect") {
      signatures.push({
        color: asString(element.color),
        fillColor: asString(element.fill_color),
        isFilled: element.is_filled === true,
        strokeWidthCircuitUnits: asNumber(element.stroke_width),
        type: element.type,
      })
      continue
    }
    if (element.type === "schematic_path") {
      signatures.push({
        fillColor: asString(element.fill_color),
        isFilled: element.is_filled === true,
        pointCount: Array.isArray(element.points) ? element.points.length : 0,
        strokeColor: asString(element.stroke_color),
        strokeWidthCircuitUnits: asNumber(element.stroke_width),
        type: element.type,
      })
    }
  }
  return signatures
}

function getStringFields({
  circuitJson,
  elementType,
  fieldName,
}: {
  circuitJson: CircuitElement[]
  elementType: PreservedElementType
  fieldName: string
}): string[] {
  return circuitJson
    .filter((element) => element.type === elementType)
    .map((element) => asString(element[fieldName]))
}

function getSchematicGeometryPoints(circuitJson: CircuitElement[]): Point[] {
  const points: Point[] = []
  const noConnectSourcePortIds = new Set<SourcePortId>(
    circuitJson.flatMap((element) =>
      element.type === "source_port" && element.do_not_connect === true
        ? [asString(element.source_port_id)]
        : [],
    ),
  )
  for (const element of circuitJson) {
    if (
      element.type === "schematic_component" ||
      element.type === "schematic_port"
    ) {
      if (
        element.type === "schematic_component" &&
        element.is_schematic_group === true
      ) {
        continue
      }
      if (
        element.type === "schematic_port" &&
        asString(element.schematic_sheet_id) &&
        !asString(element.schematic_component_id)
      ) {
        continue
      }
      if (
        element.type === "schematic_port" &&
        !asString(element.schematic_component_id) &&
        element.is_internal_circuit_port !== true &&
        noConnectSourcePortIds.has(asString(element.source_port_id))
      ) {
        continue
      }
      const center = asPoint(element.center)
      if (center) points.push(center)
      continue
    }
    if (element.type === "schematic_net_label") {
      const anchor = asPoint(element.anchor_position) ?? asPoint(element.center)
      if (anchor) points.push(anchor)
      continue
    }
    if (element.type === "schematic_text") {
      if (asString(element.schematic_component_id)) continue
      const position = asPoint(element.position)
      if (position) points.push(position)
      continue
    }
    if (element.type === "schematic_rect") {
      const center = asPoint(element.center)
      const width = asNumber(element.width)
      const height = asNumber(element.height)
      if (center) {
        points.push(
          { x: center.x - width / 2, y: center.y - height / 2 },
          { x: center.x + width / 2, y: center.y + height / 2 },
        )
      }
      continue
    }
    if (element.type === "schematic_line") {
      points.push(
        { x: asNumber(element.x1), y: asNumber(element.y1) },
        { x: asNumber(element.x2), y: asNumber(element.y2) },
      )
      continue
    }
    if (
      element.type === "schematic_arc" ||
      element.type === "schematic_circle"
    ) {
      const center = asPoint(element.center)
      const radius = asNumber(element.radius)
      if (center) {
        points.push(
          center,
          { x: center.x + radius, y: center.y },
          { x: center.x, y: center.y + radius },
        )
      }
      continue
    }
    if (element.type === "schematic_path") {
      if (Array.isArray(element.points)) {
        for (const point of element.points) {
          const circuitPoint = asPoint(point)
          if (circuitPoint) points.push(circuitPoint)
        }
      }
      continue
    }
    if (element.type !== "schematic_trace") continue
    if (Array.isArray(element.edges)) {
      for (const edge of element.edges) {
        if (!isCircuitElement(edge)) continue
        const from = asPoint(edge.from)
        const to = asPoint(edge.to)
        if (from) points.push(from)
        if (to) points.push(to)
      }
    }
    if (Array.isArray(element.junctions)) {
      for (const junction of element.junctions) {
        const point = asPoint(junction)
        if (point) points.push(point)
      }
    }
  }
  return points
}

function getGeometryMaxDelta(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourcePoints = getSchematicGeometryPoints(sourceCircuitJson)
  const roundTripPoints = getSchematicGeometryPoints(roundTripCircuitJson)
  if (sourcePoints.length !== roundTripPoints.length) {
    return Number.POSITIVE_INFINITY
  }
  const sourceAnchor = sourcePoints[0]
  const roundTripAnchor = roundTripPoints[0]
  if (!sourceAnchor || !roundTripAnchor) return 0

  let maximumDelta = 0
  for (const [pointIndex, sourcePoint] of sourcePoints.entries()) {
    const roundTripPoint = roundTripPoints[pointIndex]
    if (!roundTripPoint) return Number.POSITIVE_INFINITY
    maximumDelta = Math.max(
      maximumDelta,
      Math.abs(
        sourcePoint.x - sourceAnchor.x - (roundTripPoint.x - roundTripAnchor.x),
      ),
      Math.abs(
        sourcePoint.y - sourceAnchor.y - (roundTripPoint.y - roundTripAnchor.y),
      ),
    )
  }
  return maximumDelta
}

function getComponentSizes(circuitJson: CircuitElement[]): CircuitSize[] {
  return circuitJson.flatMap((element) => {
    if (element.type !== "schematic_component") return []
    if (!isCircuitElement(element.size)) return []
    const { height, width } = element.size
    return typeof height === "number" && typeof width === "number"
      ? [{ height, width }]
      : []
  })
}

function getComponentSizeMaxDelta(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourceSizes = getComponentSizes(sourceCircuitJson)
  const roundTripSizes = getComponentSizes(roundTripCircuitJson)
  if (sourceSizes.length !== roundTripSizes.length) {
    return Number.POSITIVE_INFINITY
  }
  return sourceSizes.reduce((maximumDelta, sourceSize, sizeIndex) => {
    const roundTripSize = roundTripSizes[sizeIndex]
    if (!roundTripSize) return Number.POSITIVE_INFINITY
    return Math.max(
      maximumDelta,
      Math.abs(sourceSize.width - roundTripSize.width),
      Math.abs(sourceSize.height - roundTripSize.height),
    )
  }, 0)
}

export function getSchematicRoundTripMetrics({
  roundTripCircuitJson,
  sourceCircuitJson,
}: {
  roundTripCircuitJson: CircuitElement[]
  sourceCircuitJson: CircuitElement[]
}): SchematicRoundTripMetrics {
  const sourceCounts = countSchematicPrimitives(sourceCircuitJson)
  const roundTripCounts = countSchematicPrimitives(roundTripCircuitJson)
  return {
    componentSizeMaxDeltaCircuitUnits: getComponentSizeMaxDelta(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    geometryMaxDeltaCircuitUnits: getGeometryMaxDelta(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    roundTripAnnotationSignatures:
      getSchematicAnnotationSignatures(roundTripCircuitJson),
    roundTripComponentTextSignatures:
      getSchematicComponentTextSignatures(roundTripCircuitJson),
    roundTripSymbolPrimitiveCounts:
      getSchematicSymbolPrimitiveCounts(roundTripCircuitJson),
    roundTripComponentNames: getStringFields({
      circuitJson: roundTripCircuitJson,
      elementType: "source_component",
      fieldName: "name",
    }),
    roundTripComponentPartSignatures:
      getComponentPartSignatures(roundTripCircuitJson),
    roundTripCounts,
    roundTripNetLabelTexts: getStringFields({
      circuitJson: roundTripCircuitJson,
      elementType: "schematic_net_label",
      fieldName: "text",
    }),
    roundTripOffSheetPortSignatures:
      getOffSheetPortSignatures(roundTripCircuitJson),
    roundTripPowerPortSymbolNames:
      getPowerPortSymbolNames(roundTripCircuitJson),
    roundTripSheetSignatures: getSchematicSheetSignatures(roundTripCircuitJson),
    roundTripPortNames: getStringFields({
      circuitJson: roundTripCircuitJson,
      elementType: "source_port",
      fieldName: "name",
    }),
    sourceComponentNames: getStringFields({
      circuitJson: sourceCircuitJson,
      elementType: "source_component",
      fieldName: "name",
    }),
    sourceComponentPartSignatures:
      getComponentPartSignatures(sourceCircuitJson),
    sourceSymbolPrimitiveCounts:
      getSchematicSymbolPrimitiveCounts(sourceCircuitJson),
    sourceAnnotationSignatures:
      getSchematicAnnotationSignatures(sourceCircuitJson),
    sourceComponentTextSignatures:
      getSchematicComponentTextSignatures(sourceCircuitJson),
    sourceCounts,
    sourceNetLabelTexts: getStringFields({
      circuitJson: sourceCircuitJson,
      elementType: "schematic_net_label",
      fieldName: "text",
    }),
    sourceOffSheetPortSignatures: getOffSheetPortSignatures(sourceCircuitJson),
    sourcePowerPortSymbolNames: getPowerPortSymbolNames(sourceCircuitJson),
    sourceSheetSignatures: getSchematicSheetSignatures(sourceCircuitJson),
    sourcePortNames: getStringFields({
      circuitJson: sourceCircuitJson,
      elementType: "source_port",
      fieldName: "name",
    }),
    sourceSupportedPrimitiveTotal:
      sourceCounts.schematic_component +
      sourceCounts.do_not_connect +
      sourceCounts.schematic_port +
      sourceCounts.schematic_net_label +
      sourceCounts.schematic_path +
      sourceCounts.schematic_rect +
      sourceCounts.schematic_text +
      getSchematicSymbolPrimitiveCounts(sourceCircuitJson).total +
      sourceCounts.wire_segment +
      sourceCounts.junction,
  }
}
