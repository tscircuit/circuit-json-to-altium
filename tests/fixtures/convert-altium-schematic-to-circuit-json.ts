import {
  type AltiumPoint,
  type AltiumRecord,
  type AltiumSchComponentRecord,
  type AltiumSchDoc,
  AltiumSchPinRecord,
  type AltiumSchPowerPortRecord,
  getSchematicRecordPoints,
  resolveSchematicParameterReferenceWithContext,
} from "altiumts"
import type {
  CircuitElement,
  SchematicComponentId,
  SourceNetId,
} from "../../lib/types"
import {
  type CircuitPoint,
  getRecordCorner,
  getRecordLocation,
  getSchematicCoordinate,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"
import type { AltiumSchematicProjectContext } from "./altium-schematic-project-context"
import { appendAltiumSchematicComponentTextElements } from "./append-altium-schematic-component-text-elements"
import { appendAltiumSchematicPinTextElements } from "./append-altium-schematic-pin-text-elements"
import { appendAltiumSchematicSheetAnnotationElements } from "./append-altium-schematic-sheet-annotation-elements"
import { appendAltiumSchematicSheetElements } from "./append-altium-schematic-sheet-elements"
import { appendAltiumSchematicSymbolPrimitives } from "./append-altium-schematic-symbol-primitives"
import { getAltiumSchematicTextPresentation } from "./get-altium-schematic-text-presentation"
import { isAltiumSchematicComponentRecordVisible } from "./is-altium-schematic-component-record-visible"
import { preserveAltiumNoConnectRecords } from "./preserve-altium-no-connect-records"

type AltiumBounds = {
  maxX: number
  maxY: number
  minX: number
  minY: number
}

type AltiumPowerPortDirection = "down" | "left" | "right" | "up"
type SchematicNetLabelAnchorSide = "bottom" | "left" | "right" | "top"
type SourceNetName = string
type SupplierName =
  | "digikey"
  | "jlcpcb"
  | "lcsc"
  | "macrofab"
  | "mouser"
  | "pcbway"

type SchematicNetContext = {
  elements: CircuitElement[]
  sourceNetIdByName: Map<SourceNetName, SourceNetId>
}

type AppendNativeTextPresentationInput = {
  document: AltiumSchDoc
  elements: CircuitElement[]
  record: AltiumRecord
  schematicTextId: string
  text: string
}

const ALTIUM_POWER_PORT_DIRECTION_BY_ORIENTATION_INDEX = [
  "right",
  "up",
  "left",
  "down",
] as const

const SCHEMATIC_NET_LABEL_ANCHOR_SIDE_BY_POWER_PORT_DIRECTION: Record<
  AltiumPowerPortDirection,
  SchematicNetLabelAnchorSide
> = {
  right: "left",
  up: "bottom",
  left: "right",
  down: "top",
}

const PIN_FACING_DIRECTION_BY_ORIENTATION = [
  "right",
  "up",
  "left",
  "down",
] as const

const ALTIUM_PIN_NAME_VISIBLE_FLAG = 0x08
const ALTIUM_PIN_NUMBER_VISIBLE_FLAG = 0x10

const SUPPLIER_NAME_BY_PARAMETER_NAME: Record<string, SupplierName> = {
  "digikey part number": "digikey",
  "jlcpcb part number": "jlcpcb",
  "lcsc part number": "lcsc",
  "macrofab part number": "macrofab",
  "mouser part number": "mouser",
  "pcbway part number": "pcbway",
}

function normalizeSupplierName(value: string): SupplierName | undefined {
  const normalized = value.replaceAll(/[^a-z0-9]/giu, "").toLowerCase()
  if (normalized === "digikey") return "digikey"
  if (normalized === "jlcpcb") return "jlcpcb"
  if (normalized === "lcsc") return "lcsc"
  if (normalized === "macrofab") return "macrofab"
  if (normalized === "mouser") return "mouser"
  if (normalized === "pcbway") return "pcbway"
  return undefined
}

function getSourceComponentPartFields({
  component,
  document,
}: {
  component: AltiumSchComponentRecord
  document: AltiumSchDoc
}): Partial<
  Pick<CircuitElement, "manufacturer_part_number" | "supplier_part_numbers">
> {
  const parameters = document
    .getOwnedRecords(component)
    .filter(
      (record) => record.recordKind === "34" || record.recordKind === "41",
    )
  const getParameterText = (...names: string[]): string | undefined => {
    const normalizedNames = new Set(names.map((name) => name.toLowerCase()))
    return parameters
      .find((record) =>
        normalizedNames.has(record.getDecoded("NAME")?.toLowerCase() ?? ""),
      )
      ?.getDecoded("TEXT")
  }

  const supplierPartNumbers: Partial<Record<SupplierName, string[]>> = {}
  const appendSupplierPartNumber = (
    supplierName: SupplierName | undefined,
    partNumber: string | undefined,
  ): void => {
    if (!supplierName || !partNumber) return
    const existingPartNumbers = supplierPartNumbers[supplierName] ?? []
    for (const normalizedPartNumber of partNumber
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)) {
      if (!existingPartNumbers.includes(normalizedPartNumber)) {
        existingPartNumbers.push(normalizedPartNumber)
      }
    }
    supplierPartNumbers[supplierName] = existingPartNumbers
  }

  for (const parameter of parameters) {
    const parameterName = parameter.getDecoded("NAME")?.toLowerCase() ?? ""
    appendSupplierPartNumber(
      SUPPLIER_NAME_BY_PARAMETER_NAME[parameterName],
      parameter.getDecoded("TEXT"),
    )
  }

  for (const supplierParameter of parameters) {
    const supplierParameterName =
      supplierParameter.getDecoded("NAME")?.toLowerCase() ?? ""
    const supplierMatch = /^supplier(?: (\d+))?$/u.exec(supplierParameterName)
    if (!supplierMatch) continue
    const suffix = supplierMatch[1]
    const partNumber = suffix
      ? getParameterText(`Supplier Part Number ${suffix}`)
      : getParameterText("Supplier Part")
    appendSupplierPartNumber(
      normalizeSupplierName(supplierParameter.getDecoded("TEXT") ?? ""),
      partNumber,
    )
  }

  const manufacturerPartNumber = getParameterText(
    "Manufacturer Part Number",
    "Manufacturer Part",
  )
  return {
    ...(manufacturerPartNumber
      ? { manufacturer_part_number: manufacturerPartNumber }
      : {}),
    ...(Object.keys(supplierPartNumbers).length > 0
      ? { supplier_part_numbers: supplierPartNumbers }
      : {}),
  }
}

function appendNativeTextPresentation({
  document,
  elements,
  record,
  schematicTextId,
  text,
}: AppendNativeTextPresentationInput): void {
  elements.push({
    type: "schematic_text",
    schematic_text_id: schematicTextId,
    text,
    ...getAltiumSchematicTextPresentation({
      document,
      fallbackFontSizePoints: 9,
      record,
    }),
  })
}

function hasComponentAncestor({
  document,
  record,
}: {
  document: AltiumSchDoc
  record: AltiumRecord
}): boolean {
  const visitedRecords = new Set<AltiumRecord>()
  let currentRecord: AltiumRecord | undefined = record
  while (currentRecord && !visitedRecords.has(currentRecord)) {
    visitedRecords.add(currentRecord)
    const parentRecord = document.getParent(currentRecord)
    if (parentRecord?.recordKind === "1") return true
    currentRecord = parentRecord
  }
  return false
}

function appendUnownedVisibleParameterTextElements({
  document,
  elements,
  projectContext,
}: {
  document: AltiumSchDoc
  elements: CircuitElement[]
  projectContext?: AltiumSchematicProjectContext
}): void {
  for (const [recordIndex, record] of document.records.entries()) {
    const sourceText =
      record.getDecoded("TEXT") ?? record.getDecoded("NAME") ?? ""
    if (
      record.recordKind !== "41" ||
      !sourceText ||
      record.getBoolean("ISHIDDEN") === true ||
      hasComponentAncestor({ document, record })
    ) {
      continue
    }
    appendNativeTextPresentation({
      document,
      elements,
      record,
      schematicTextId: `schematic_text_unowned_parameter_${recordIndex}`,
      text:
        resolveSchematicParameterReferenceWithContext({
          document,
          reference: sourceText,
          ...projectContext,
        }) ?? sourceText,
    })
  }
}

function getGraphicRecordPoints(record: AltiumRecord): AltiumPoint[] {
  if (record.recordKind === "6" || record.recordKind === "7") {
    return getSchematicRecordPoints(record)
  }

  if (record.recordKind === "10" || record.recordKind === "14") {
    return [getRecordLocation(record), getRecordCorner(record)]
  }

  if (record.recordKind === "13") {
    return [getRecordLocation(record), getRecordCorner(record)]
  }

  if (
    record.recordKind === "8" ||
    record.recordKind === "11" ||
    record.recordKind === "12"
  ) {
    const center = getRecordLocation(record)
    const radiusX = getSchematicCoordinate({
      fallback: 1,
      key: "RADIUS",
      record,
    })
    const radiusY = getSchematicCoordinate({
      fallback: radiusX,
      key: "SECONDARYRADIUS",
      record,
    })
    return [
      { x: center.x - radiusX, y: center.y - radiusY },
      { x: center.x + radiusX, y: center.y + radiusY },
    ]
  }

  return []
}

function getComponentBounds(
  document: AltiumSchDoc,
  component: AltiumSchComponentRecord,
): AltiumBounds {
  const points = document
    .getOwnedRecords(component)
    .filter((record) =>
      isAltiumSchematicComponentRecordVisible({ component, record }),
    )
    .flatMap(getGraphicRecordPoints)

  if (points.length === 0) {
    const center = component.position ?? { x: 0, y: 0 }
    return {
      maxX: center.x + 10,
      maxY: center.y + 10,
      minX: center.x - 10,
      minY: center.y - 10,
    }
  }

  return {
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
  }
}

function getOwnedParameterRecord({
  component,
  document,
  parameterName,
  requireVisible = false,
}: {
  component: AltiumSchComponentRecord
  document: AltiumSchDoc
  parameterName: string
  requireVisible?: boolean
}): AltiumRecord | undefined {
  return document
    .getOwnedRecords(component)
    .find(
      (record) =>
        (record.recordKind === "34" || record.recordKind === "41") &&
        record.getDecoded("NAME")?.toLowerCase() ===
          parameterName.toLowerCase() &&
        (!requireVisible || record.getBoolean("ISHIDDEN") !== true),
    )
}

function appendComponentParameterText({
  componentIndex,
  document,
  elements,
  parameter,
  parameterName,
  schematicComponentId,
}: {
  componentIndex: number
  document: AltiumSchDoc
  elements: CircuitElement[]
  parameter: AltiumRecord | undefined
  parameterName: "comment" | "designator"
  schematicComponentId: SchematicComponentId
}): void {
  const text = parameter?.getDecoded("TEXT") ?? ""
  if (!parameter || !text || parameter.getBoolean("ISHIDDEN") === true) return
  elements.push({
    type: "schematic_text",
    schematic_text_id: `schematic_text_component_${componentIndex}_${parameterName}`,
    schematic_component_id: schematicComponentId,
    text,
    ...getAltiumSchematicTextPresentation({
      document,
      fallbackFontSizePoints: 9,
      record: parameter,
    }),
  })
}

function isVisiblePin(
  component: AltiumSchComponentRecord,
  pin: AltiumSchPinRecord,
): boolean {
  const pinConglomerate = pin.getNumber("PINCONGLOMERATE")
  const isHidden =
    pin.hidden === true ||
    (pinConglomerate !== undefined && (pinConglomerate & 0x04) !== 0)
  return (
    !isHidden &&
    isAltiumSchematicComponentRecordVisible({ component, record: pin })
  )
}

function getPinOrientation(pin: AltiumSchPinRecord): number {
  const pinConglomerate = pin.getNumber("PINCONGLOMERATE")
  const orientation = pinConglomerate ?? pin.getNumber("ORIENTATION") ?? 0
  return ((Math.round(orientation) % 4) + 4) % 4
}

function getPinTerminal(pin: AltiumSchPinRecord): AltiumPoint {
  const body = pin.position ?? { x: 0, y: 0 }
  const length = Math.max(
    getSchematicCoordinate({ fallback: 10, key: "PINLENGTH", record: pin }),
    1,
  )
  const orientation = getPinOrientation(pin)
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation] ?? { x: 1, y: 0 }
  return {
    x: body.x + direction.x * length,
    y: body.y + direction.y * length,
  }
}

function getNumericPinNumber(
  pinDesignator: string | undefined,
): number | undefined {
  if (!pinDesignator || !/^\d+$/u.test(pinDesignator)) return undefined
  const pinNumber = Number(pinDesignator)
  return Number.isSafeInteger(pinNumber) ? pinNumber : undefined
}

function getPowerPortDirection(
  powerPort: AltiumSchPowerPortRecord,
): AltiumPowerPortDirection {
  const orientationIndex = powerPort.getNumber("ORIENTATION") ?? 0
  const normalizedOrientationIndex =
    ((Math.round(orientationIndex) % 4) + 4) % 4
  return (
    ALTIUM_POWER_PORT_DIRECTION_BY_ORIENTATION_INDEX[
      normalizedOrientationIndex
    ] ?? "right"
  )
}

function getPowerPortSymbolName(
  powerPort: AltiumSchPowerPortRecord,
): string | undefined {
  const styleIndex = powerPort.getNumber("STYLE") ?? 2
  const symbolFamily =
    styleIndex === 2 ? "rail" : styleIndex === 4 ? "ground" : undefined
  if (!symbolFamily) return undefined
  return `${symbolFamily}_${getPowerPortDirection(powerPort)}`
}

function getOrCreateSourceNetId(
  { sourceNetName }: { sourceNetName: SourceNetName },
  context: SchematicNetContext,
): SourceNetId {
  const existingSourceNetId = context.sourceNetIdByName.get(sourceNetName)
  if (existingSourceNetId) return existingSourceNetId
  const sourceNetId = `source_net_${context.sourceNetIdByName.size}`
  context.sourceNetIdByName.set(sourceNetName, sourceNetId)
  context.elements.push({
    type: "source_net",
    source_net_id: sourceNetId,
    name: sourceNetName,
    member_source_group_ids: [],
  })
  return sourceNetId
}

function appendComponentElements({
  component,
  componentIndex,
  document,
  elements,
}: {
  component: AltiumSchComponentRecord
  componentIndex: number
  document: AltiumSchDoc
  elements: CircuitElement[]
}): void {
  const sourceComponentId = `source_component_${componentIndex}`
  const schematicComponentId = `schematic_component_${componentIndex}`
  const schematicSymbolId = `schematic_symbol_${componentIndex}`
  const bounds = getComponentBounds(document, component)
  const center = toCircuitPoint({
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  })
  const designatorParameter = getOwnedParameterRecord({
    component,
    document,
    parameterName: "Designator",
  })
  const commentParameter = getOwnedParameterRecord({
    component,
    document,
    parameterName: "Comment",
    requireVisible: true,
  })
  const designator =
    designatorParameter?.getDecoded("TEXT") ?? `U${componentIndex + 1}`
  const comment = commentParameter?.getDecoded("TEXT")

  elements.push(
    {
      type: "source_component",
      source_component_id: sourceComponentId,
      name: designator,
      ...getSourceComponentPartFields({ component, document }),
    },
    {
      type: "schematic_symbol",
      schematic_symbol_id: schematicSymbolId,
      name: component.libraryReference ?? designator,
    },
    {
      type: "schematic_component",
      schematic_component_id: schematicComponentId,
      source_component_id: sourceComponentId,
      schematic_symbol_id: schematicSymbolId,
      center,
      size: {
        width: toCircuitLength(Math.max(bounds.maxX - bounds.minX, 1)),
        height: toCircuitLength(Math.max(bounds.maxY - bounds.minY, 1)),
      },
      ...(comment ? { symbol_display_value: comment } : {}),
    },
  )

  appendAltiumSchematicSymbolPrimitives({
    component,
    document,
    elements,
    schematicComponentId,
    schematicSymbolId,
  })

  appendComponentParameterText({
    componentIndex,
    document,
    elements,
    parameter: designatorParameter,
    parameterName: "designator",
    schematicComponentId,
  })
  appendComponentParameterText({
    componentIndex,
    document,
    elements,
    parameter: commentParameter,
    parameterName: "comment",
    schematicComponentId,
  })
  appendAltiumSchematicComponentTextElements({
    component,
    document,
    elements,
    excludedRecords: new Set(commentParameter ? [commentParameter] : []),
    schematicComponentId,
  })

  const visiblePins = document
    .getOwnedRecords(component)
    .filter(
      (record): record is AltiumSchPinRecord =>
        record instanceof AltiumSchPinRecord && isVisiblePin(component, record),
    )
  for (const [pinIndex, pin] of visiblePins.entries()) {
    const sourcePortId = `source_port_${componentIndex}_${pinIndex}`
    const pinNumber = getNumericPinNumber(pin.designator)
    const orientation = getPinOrientation(pin)
    const pinConglomerate = pin.getNumber("PINCONGLOMERATE")
    const isPinNameVisible =
      pinConglomerate === undefined ||
      (pinConglomerate & ALTIUM_PIN_NAME_VISIBLE_FLAG) !== 0
    const isPinNumberVisible =
      pinConglomerate === undefined ||
      (pinConglomerate & ALTIUM_PIN_NUMBER_VISIBLE_FLAG) !== 0
    elements.push(
      {
        type: "source_port",
        source_port_id: sourcePortId,
        source_component_id: sourceComponentId,
        name: pin.name || pin.designator || `Pin ${pinIndex + 1}`,
        ...(pinNumber === undefined ? {} : { pin_number: pinNumber }),
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_${componentIndex}_${pinIndex}`,
        schematic_component_id: schematicComponentId,
        source_port_id: sourcePortId,
        center: toCircuitPoint(getPinTerminal(pin)),
        distance_from_component_edge: toCircuitLength(
          Math.max(
            getSchematicCoordinate({
              fallback: 10,
              key: "PINLENGTH",
              record: pin,
            }),
            1,
          ),
        ),
        facing_direction:
          PIN_FACING_DIRECTION_BY_ORIENTATION[orientation] ?? "right",
        ...(isPinNumberVisible && pinNumber !== undefined
          ? { pin_number: pinNumber }
          : {}),
        ...(isPinNameVisible && pin.name
          ? { display_pin_label: pin.name }
          : {}),
      },
    )
    appendAltiumSchematicPinTextElements({
      componentIndex,
      document,
      elements,
      pin,
      pinIndex,
      schematicComponentId,
    })
  }
}

function appendWireElements(
  document: AltiumSchDoc,
  elements: CircuitElement[],
): void {
  for (const [wireIndex, wire] of document.wires.entries()) {
    const points = getSchematicRecordPoints(wire).map(toCircuitPoint)
    const edges: Array<{ from: CircuitPoint; to: CircuitPoint }> = []
    for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
      const from = points[pointIndex - 1]
      const to = points[pointIndex]
      if (from && to) edges.push({ from, to })
    }
    if (edges.length === 0) continue
    const sourceTraceId = `source_trace_wire_${wireIndex}`
    elements.push(
      {
        type: "source_trace",
        source_trace_id: sourceTraceId,
        connected_source_port_ids: [],
        connected_source_net_ids: [],
      },
      {
        type: "schematic_trace",
        schematic_trace_id: `schematic_trace_wire_${wireIndex}`,
        source_trace_id: sourceTraceId,
        edges,
        junctions: [],
      },
    )
  }

  const junctions = document
    .getRecordsByKind("29")
    .filter((junction) => document.getParent(junction) === undefined)
    .map((junction) => toCircuitPoint(getRecordLocation(junction)))
  if (junctions.length > 0) {
    elements.push({
      type: "schematic_trace",
      schematic_trace_id: "schematic_trace_junctions",
      edges: [],
      junctions,
    })
  }
}

function appendOffSheetPortElements(
  document: AltiumSchDoc,
  elements: CircuitElement[],
): void {
  for (const [portIndex, port] of document.ports.entries()) {
    const portName = port.name ?? ""
    if (!portName) continue
    const ioType = port.getNumber("IOTYPE") ?? 0
    const sourcePortId = `source_port_off_sheet_${portIndex}`
    elements.push(
      {
        type: "source_port",
        source_port_id: sourcePortId,
        name: portName,
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_off_sheet_${portIndex}`,
        source_port_id: sourcePortId,
        center: toCircuitPoint(port.position ?? { x: 0, y: 0 }),
        display_pin_label: portName,
        facing_direction: ioType === 1 ? "left" : "right",
        is_internal_circuit_port: true,
        ...(ioType === 1 || ioType === 3 ? { has_input_arrow: true } : {}),
        ...(ioType === 2 || ioType === 3 ? { has_output_arrow: true } : {}),
      },
    )
  }
}

function appendNetLabelElements(
  document: AltiumSchDoc,
  elements: CircuitElement[],
): void {
  const schematicNetContext: SchematicNetContext = {
    elements,
    sourceNetIdByName: new Map<SourceNetName, SourceNetId>(),
  }

  for (const [labelIndex, label] of document.netLabels.entries()) {
    const text = label.text ?? ""
    if (!text) continue
    const sourceNetId = getOrCreateSourceNetId(
      { sourceNetName: text },
      schematicNetContext,
    )
    const position = toCircuitPoint(label.position ?? { x: 0, y: 0 })
    elements.push({
      type: "schematic_net_label",
      schematic_net_label_id: `schematic_net_label_${labelIndex}`,
      source_net_id: sourceNetId,
      center: position,
      anchor_position: position,
      anchor_side: "left",
      text,
    })
    appendNativeTextPresentation({
      document,
      elements,
      record: label,
      schematicTextId: `schematic_text_net_label_${labelIndex}`,
      text,
    })
  }

  for (const [powerPortIndex, powerPort] of document.powerPorts.entries()) {
    const text = powerPort.text ?? ""
    if (!text) continue
    const sourceNetId = getOrCreateSourceNetId(
      { sourceNetName: text },
      schematicNetContext,
    )
    const position = toCircuitPoint(powerPort.position ?? { x: 0, y: 0 })
    const powerPortDirection = getPowerPortDirection(powerPort)
    const symbolName = getPowerPortSymbolName(powerPort)
    elements.push({
      type: "schematic_net_label",
      schematic_net_label_id: `schematic_net_label_power_port_${powerPortIndex}`,
      source_net_id: sourceNetId,
      center: position,
      anchor_position: position,
      anchor_side:
        SCHEMATIC_NET_LABEL_ANCHOR_SIDE_BY_POWER_PORT_DIRECTION[
          powerPortDirection
        ],
      text,
      ...(symbolName ? { symbol_name: symbolName } : {}),
    })
    appendNativeTextPresentation({
      document,
      elements,
      record: powerPort,
      schematicTextId: `schematic_text_power_port_${powerPortIndex}`,
      text,
    })
  }
}

export function convertAltiumSchematicToCircuitJson(
  document: AltiumSchDoc,
  projectContext?: AltiumSchematicProjectContext,
): CircuitElement[] {
  const elements: CircuitElement[] = []
  for (const [componentIndex, component] of document.components.entries()) {
    appendComponentElements({
      component,
      componentIndex,
      document,
      elements,
    })
  }
  appendOffSheetPortElements(document, elements)
  appendWireElements(document, elements)
  appendNetLabelElements(document, elements)
  appendUnownedVisibleParameterTextElements({
    document,
    elements,
    projectContext,
  })
  appendAltiumSchematicSheetElements(document, elements)
  preserveAltiumNoConnectRecords({ document, elements })
  appendAltiumSchematicSheetAnnotationElements({
    document,
    elements,
    projectContext,
  })
  return elements
}
