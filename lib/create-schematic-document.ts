import { createAltiumSchematicComponentGraphicRecordFields } from "./create-altium-schematic-component-graphic-record-fields"
import { createAltiumSchematicFontTable } from "./create-altium-schematic-font-table"
import { createAltiumSchematicNetLabelRecordFields } from "./create-altium-schematic-net-label-record-fields"
import { createAltiumSchematicNoConnectRecordFields } from "./create-altium-schematic-no-connect-record-fields"
import { createAltiumSchematicOffSheetPortRecordFields } from "./create-altium-schematic-off-sheet-port-record-fields"
import { createAltiumSchematicSheetAnnotationRecordFields } from "./create-altium-schematic-sheet-annotation-record-fields"
import { createAltiumSchematicSymbolRecords } from "./create-altium-schematic-symbol-records"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  isCircuitElement,
  sanitizeField,
} from "./format"
import { getSchematicTransform } from "./get-schematic-transform"
import { isSchematicComponentGraphic } from "./is-schematic-component-graphic"
import type {
  CircuitElement,
  Point,
  PointTransform,
  SchematicComponentId,
  SchematicSheetId,
  SourceComponentId,
  SourcePortId,
} from "./types"

type CreateSchematicDocumentParams = {
  circuitJson: CircuitElement[]
  isFirstSchematicSheet: boolean
  schematicSheetId: SchematicSheetId | undefined
}

type SchematicSheetMembershipParams = {
  element: CircuitElement
  isFirstSchematicSheet: boolean
  schematicSheetId: SchematicSheetId | undefined
}

type SchematicRecordContext = {
  lines: string[]
  nextRecordIndex: number
}

type AltiumSchematicPointKey = string

type AltiumSchematicBoxBounds = {
  bottom: number
  left: number
  right: number
  top: number
}

type BoxedSchematicPinGeometryParams = {
  circuitPinTerminal: Point
  circuitToAltiumSchematicPoint: PointTransform
  distanceFromComponentEdge: number
  facingDirection: string
}

type FallbackSchematicBoxBoundsParams = {
  circuitComponentCenter: Point
  circuitComponentHeight: number
  circuitComponentWidth: number
  circuitToAltiumSchematicPoint: PointTransform
}

const ALTIUM_PIN_STANDARD_FLAGS = 0x20
const ALTIUM_PIN_NAME_VISIBLE_FLAG = 0x08
const ALTIUM_PIN_DESIGNATOR_VISIBLE_FLAG = 0x10
const ALTIUM_PIN_ORIENTATION_BY_FACING_DIRECTION: Record<string, number> = {
  left: 2,
  right: 0,
  up: 1,
  down: 3,
}
const DEFAULT_PIN_OUTWARD_DIRECTION: Point = { x: -1, y: 0 }
const PIN_OUTWARD_DIRECTION_BY_FACING_DIRECTION: Record<string, Point> = {
  left: DEFAULT_PIN_OUTWARD_DIRECTION,
  right: { x: 1, y: 0 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
}

function getFallbackSchematicBoxBounds({
  circuitComponentCenter,
  circuitComponentHeight,
  circuitComponentWidth,
  circuitToAltiumSchematicPoint,
}: FallbackSchematicBoxBoundsParams): AltiumSchematicBoxBounds {
  const firstCorner = circuitToAltiumSchematicPoint({
    x: circuitComponentCenter.x - circuitComponentWidth / 2,
    y: circuitComponentCenter.y - circuitComponentHeight / 2,
  })
  const oppositeCorner = circuitToAltiumSchematicPoint({
    x: circuitComponentCenter.x + circuitComponentWidth / 2,
    y: circuitComponentCenter.y + circuitComponentHeight / 2,
  })
  return {
    bottom: Math.min(firstCorner.y, oppositeCorner.y),
    left: Math.min(firstCorner.x, oppositeCorner.x),
    right: Math.max(firstCorner.x, oppositeCorner.x),
    top: Math.max(firstCorner.y, oppositeCorner.y),
  }
}

function getBoxedSchematicPinGeometry({
  circuitPinTerminal,
  circuitToAltiumSchematicPoint,
  distanceFromComponentEdge,
  facingDirection,
}: BoxedSchematicPinGeometryParams): { length: number; location: Point } {
  const outwardDirection =
    PIN_OUTWARD_DIRECTION_BY_FACING_DIRECTION[facingDirection] ??
    DEFAULT_PIN_OUTWARD_DIRECTION
  const circuitPinBody = {
    x: circuitPinTerminal.x - outwardDirection.x * distanceFromComponentEdge,
    y: circuitPinTerminal.y - outwardDirection.y * distanceFromComponentEdge,
  }
  const altiumPinBody = circuitToAltiumSchematicPoint(circuitPinBody)
  const altiumPinTerminal = circuitToAltiumSchematicPoint(circuitPinTerminal)
  return {
    length: Math.max(
      1,
      Math.round(
        Math.hypot(
          altiumPinTerminal.x - altiumPinBody.x,
          altiumPinTerminal.y - altiumPinBody.y,
        ),
      ),
    ),
    location: altiumPinBody,
  }
}

function doesElementBelongToSchematicSheet({
  element,
  isFirstSchematicSheet,
  schematicSheetId,
}: SchematicSheetMembershipParams): boolean {
  const elementSchematicSheetId = asString(element.schematic_sheet_id)
  return schematicSheetId
    ? elementSchematicSheetId === schematicSheetId ||
        (isFirstSchematicSheet && !elementSchematicSheetId)
    : !elementSchematicSheetId || isFirstSchematicSheet
}

function addSchematicRecord(
  recordFields: string[],
  ctx: SchematicRecordContext,
): number {
  const altiumRecordIndex = ctx.nextRecordIndex
  ctx.lines.push(`|${recordFields.join("|")}`)
  ctx.nextRecordIndex++
  return altiumRecordIndex
}

export function createSchematicDocument({
  circuitJson,
  isFirstSchematicSheet,
  schematicSheetId,
}: CreateSchematicDocumentParams): string {
  const schematicElements = circuitJson.filter(
    (element) =>
      element.type?.startsWith("schematic_") === true &&
      element.type !== "schematic_sheet" &&
      doesElementBelongToSchematicSheet({
        element,
        isFirstSchematicSheet,
        schematicSheetId,
      }),
  )
  const {
    circuitToAltiumSchematicLength,
    circuitToAltiumSchematicPoint,
    width: altiumSheetWidth,
    height: altiumSheetHeight,
  } = getSchematicTransform(schematicElements)
  const altiumSchematicFontTable = createAltiumSchematicFontTable({
    schematicElements,
  })
  const schematicRecordContext: SchematicRecordContext = {
    lines: [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    ],
    nextRecordIndex: 0,
  }
  addSchematicRecord(
    [
      "RECORD=31",
      ...altiumSchematicFontTable.sheetRecordFields,
      `CUSTOMX=${altiumSheetWidth}`,
      `CUSTOMY=${altiumSheetHeight}`,
      "USECUSTOMSHEET=T",
      "SNAPGRIDON=T",
      "SNAPGRIDSIZE=10",
    ],
    schematicRecordContext,
  )

  const sourceComponents = new Map<SourceComponentId, CircuitElement>(
    byType(circuitJson, "source_component")
      .filter((element) => typeof element.source_component_id === "string")
      .map((element) => [asString(element.source_component_id), element]),
  )
  const sourcePorts = new Map<SourcePortId, CircuitElement>(
    byType(circuitJson, "source_port").map((sourcePort) => [
      asString(sourcePort.source_port_id),
      sourcePort,
    ]),
  )
  const schematicPortsByComponentId = new Map<
    SchematicComponentId,
    CircuitElement[]
  >()
  const schematicGraphicsByComponentId = new Map<
    SchematicComponentId,
    CircuitElement[]
  >()
  for (const graphic of schematicElements.filter(isSchematicComponentGraphic)) {
    const schematicComponentId = asString(graphic.schematic_component_id)
    schematicGraphicsByComponentId.set(schematicComponentId, [
      ...(schematicGraphicsByComponentId.get(schematicComponentId) ?? []),
      graphic,
    ])
  }
  for (const schematicPort of schematicElements.filter(
    (element) => element.type === "schematic_port",
  )) {
    const schematicComponentId = asString(schematicPort.schematic_component_id)
    if (!schematicComponentId) continue
    schematicPortsByComponentId.set(schematicComponentId, [
      ...(schematicPortsByComponentId.get(schematicComponentId) ?? []),
      schematicPort,
    ])
  }

  for (const [componentNumber, schematicComponent] of schematicElements
    .filter((element) => element.type === "schematic_component")
    .entries()) {
    const circuitComponentCenter = asPoint(schematicComponent.center) ?? {
      x: 0,
      y: 0,
    }
    const altiumComponentCenter = circuitToAltiumSchematicPoint(
      circuitComponentCenter,
    )
    const sourceComponent = sourceComponents.get(
      asString(schematicComponent.source_component_id),
    )
    const designator =
      sanitizeField(sourceComponent?.name) || `U${componentNumber + 1}`
    const componentComment = sanitizeField(
      schematicComponent.symbol_display_value,
    )
    const libraryReference =
      sanitizeField(schematicComponent.symbol_name) || designator
    const altiumComponentRecordIndex = addSchematicRecord(
      [
        "RECORD=1",
        `LOCATION.X=${altiumComponentCenter.x}`,
        `LOCATION.Y=${altiumComponentCenter.y}`,
        "ORIENTATION=0",
        `LIBREFERENCE=${libraryReference}`,
        "SHOWHIDDENPINS=F",
        "CURRENTPARTID=1",
        "ISMIRRORED=F",
        `UNIQUEID=${sanitizeField(schematicComponent.schematic_component_id)}`,
      ],
      schematicRecordContext,
    )
    const componentSize = isCircuitElement(schematicComponent.size)
      ? schematicComponent.size
      : {}
    const circuitComponentWidth = asPositiveNumber(componentSize.width, 2)
    const circuitComponentHeight = asPositiveNumber(componentSize.height, 1.5)
    const fallbackSchematicBoxBounds = getFallbackSchematicBoxBounds({
      circuitComponentCenter,
      circuitComponentHeight,
      circuitComponentWidth,
      circuitToAltiumSchematicPoint,
    })
    const schematicComponentId = asString(
      schematicComponent.schematic_component_id,
    )
    const customGraphicRecordFields = (
      schematicGraphicsByComponentId.get(schematicComponentId) ?? []
    ).flatMap((graphic) => {
      const recordFields = createAltiumSchematicComponentGraphicRecordFields({
        altiumComponentRecordIndex,
        circuitToAltiumSchematicLength,
        circuitToAltiumSchematicPoint,
        graphic,
      })
      return recordFields ? [recordFields] : []
    })
    const schematicSymbolRecords =
      customGraphicRecordFields.length === 0
        ? createAltiumSchematicSymbolRecords({
            altiumComponentRecordIndex,
            circuitComponentCenter,
            circuitToAltiumSchematicPoint,
            symbolName: asString(schematicComponent.symbol_name),
          })
        : undefined
    if (customGraphicRecordFields.length > 0) {
      for (const graphicRecordFields of customGraphicRecordFields) {
        addSchematicRecord(graphicRecordFields, schematicRecordContext)
      }
    } else if (schematicSymbolRecords) {
      for (const graphicRecordFields of schematicSymbolRecords.graphicRecordFields) {
        addSchematicRecord(graphicRecordFields, schematicRecordContext)
      }
    } else {
      addSchematicRecord(
        [
          "RECORD=14",
          `OWNERINDEX=${altiumComponentRecordIndex}`,
          "OWNERPARTID=1",
          `LOCATION.X=${fallbackSchematicBoxBounds.left}`,
          `LOCATION.Y=${fallbackSchematicBoxBounds.bottom}`,
          `CORNER.X=${fallbackSchematicBoxBounds.right}`,
          `CORNER.Y=${fallbackSchematicBoxBounds.top}`,
          "LINEWIDTH=1",
          "COLOR=136",
          "AREACOLOR=16777215",
          "ISSOLID=F",
        ],
        schematicRecordContext,
      )
    }
    const designatorPlacement = schematicSymbolRecords?.designatorPlacement
    const commentPlacement = schematicSymbolRecords?.commentPlacement
    addSchematicRecord(
      [
        "RECORD=34",
        `OWNERINDEX=${altiumComponentRecordIndex}`,
        "OWNERPARTID=-1",
        `LOCATION.X=${designatorPlacement?.position.x ?? fallbackSchematicBoxBounds.left}`,
        `LOCATION.Y=${designatorPlacement?.position.y ?? fallbackSchematicBoxBounds.top + 12}`,
        "FONTID=1",
        "NAME=Designator",
        `TEXT=${designator}`,
        "SHOWNAME=F",
        "ISHIDDEN=F",
        "ORIENTATION=0",
        `JUSTIFICATION=${designatorPlacement?.justification ?? 0}`,
      ],
      schematicRecordContext,
    )
    addSchematicRecord(
      [
        "RECORD=41",
        `OWNERINDEX=${altiumComponentRecordIndex}`,
        "OWNERPARTID=-1",
        `LOCATION.X=${commentPlacement?.position.x ?? fallbackSchematicBoxBounds.left}`,
        `LOCATION.Y=${commentPlacement?.position.y ?? fallbackSchematicBoxBounds.bottom - 12}`,
        "FONTID=2",
        "NAME=Comment",
        `TEXT=${componentComment}`,
        "SHOWNAME=F",
        `ISHIDDEN=${componentComment ? "F" : "T"}`,
        "ORIENTATION=0",
        `JUSTIFICATION=${commentPlacement?.justification ?? 0}`,
      ],
      schematicRecordContext,
    )

    const schematicPorts =
      schematicPortsByComponentId.get(schematicComponentId) ?? []
    for (const [pinIndex, schematicPort] of schematicPorts.entries()) {
      const sourcePort = sourcePorts.get(asString(schematicPort.source_port_id))
      const circuitPinTerminal = asPoint(schematicPort.center) ?? { x: 0, y: 0 }
      const facingDirection = asString(schematicPort.facing_direction)
      const boxedSchematicPinGeometry = getBoxedSchematicPinGeometry({
        circuitPinTerminal,
        circuitToAltiumSchematicPoint,
        distanceFromComponentEdge: Math.max(
          asNumber(schematicPort.distance_from_component_edge),
          0,
        ),
        facingDirection,
      })
      const altiumPinLocation = schematicSymbolRecords
        ? circuitToAltiumSchematicPoint(circuitPinTerminal)
        : boxedSchematicPinGeometry.location
      const altiumPinLength = schematicSymbolRecords
        ? 10
        : boxedSchematicPinGeometry.length
      const altiumPinOrientation =
        ALTIUM_PIN_ORIENTATION_BY_FACING_DIRECTION[facingDirection] ?? 2
      const altiumPinTextVisibilityFlags = schematicSymbolRecords
        ? 0
        : ALTIUM_PIN_NAME_VISIBLE_FLAG | ALTIUM_PIN_DESIGNATOR_VISIBLE_FLAG
      const altiumPinConglomerate =
        ALTIUM_PIN_STANDARD_FLAGS |
        altiumPinTextVisibilityFlags |
        altiumPinOrientation
      addSchematicRecord(
        [
          "RECORD=2",
          `OWNERINDEX=${altiumComponentRecordIndex}`,
          "OWNERPARTID=1",
          `DESIGNATOR=${sanitizeField(sourcePort?.pin_number) || pinIndex + 1}`,
          `NAME=${sanitizeField(schematicPort.display_pin_label) || sanitizeField(sourcePort?.name) || `Pin ${pinIndex + 1}`}`,
          `PINCONGLOMERATE=${altiumPinConglomerate}`,
          `LOCATION.X=${altiumPinLocation.x}`,
          `LOCATION.Y=${altiumPinLocation.y}`,
          `PINLENGTH=${altiumPinLength}`,
          "COLOR=136",
          "FONTID=2",
        ],
        schematicRecordContext,
      )
    }
  }

  for (const schematicPort of schematicElements.filter(
    (element) =>
      element.type === "schematic_port" &&
      !asString(element.schematic_component_id),
  )) {
    const sourcePort = sourcePorts.get(asString(schematicPort.source_port_id))
    const portName =
      sanitizeField(schematicPort.display_pin_label) ||
      sanitizeField(sourcePort?.name)
    const circuitPortPosition = asPoint(schematicPort.center)
    if (!portName || !circuitPortPosition) continue
    addSchematicRecord(
      createAltiumSchematicOffSheetPortRecordFields({
        altiumPortPosition: circuitToAltiumSchematicPoint(circuitPortPosition),
        hasInputArrow: schematicPort.has_input_arrow === true,
        hasOutputArrow: schematicPort.has_output_arrow === true,
        portName,
      }),
      schematicRecordContext,
    )
  }

  for (const schematicTrace of schematicElements.filter(
    (element) => element.type === "schematic_trace",
  )) {
    if (!Array.isArray(schematicTrace.edges)) continue
    for (const edge of schematicTrace.edges) {
      if (!isCircuitElement(edge)) continue
      const circuitStartPoint = asPoint(edge.from)
      const circuitEndPoint = asPoint(edge.to)
      if (!circuitStartPoint || !circuitEndPoint) continue
      const altiumStartPoint = circuitToAltiumSchematicPoint(circuitStartPoint)
      const altiumEndPoint = circuitToAltiumSchematicPoint(circuitEndPoint)
      addSchematicRecord(
        [
          "RECORD=27",
          "LINEWIDTH=1",
          "LOCATIONCOUNT=2",
          `X1=${altiumStartPoint.x}`,
          `Y1=${altiumStartPoint.y}`,
          `X2=${altiumEndPoint.x}`,
          `Y2=${altiumEndPoint.y}`,
          "COLOR=34816",
        ],
        schematicRecordContext,
      )
    }
  }

  const emittedJunctions = new Set<AltiumSchematicPointKey>()
  for (const schematicTrace of schematicElements.filter(
    (element) => element.type === "schematic_trace",
  )) {
    if (!Array.isArray(schematicTrace.junctions)) continue
    for (const junction of schematicTrace.junctions) {
      const circuitJunctionPoint = asPoint(junction)
      if (!circuitJunctionPoint) continue
      const altiumJunctionPoint =
        circuitToAltiumSchematicPoint(circuitJunctionPoint)
      const altiumJunctionPointKey = `${altiumJunctionPoint.x}:${altiumJunctionPoint.y}`
      if (emittedJunctions.has(altiumJunctionPointKey)) continue
      emittedJunctions.add(altiumJunctionPointKey)
      addSchematicRecord(
        [
          "RECORD=29",
          `LOCATION.X=${altiumJunctionPoint.x}`,
          `LOCATION.Y=${altiumJunctionPoint.y}`,
          "COLOR=34816",
        ],
        schematicRecordContext,
      )
    }
  }

  for (const schematicNetLabel of schematicElements.filter(
    (element) => element.type === "schematic_net_label",
  )) {
    const labelText = sanitizeField(schematicNetLabel.text)
    if (!labelText) continue
    const altiumLabelPosition = circuitToAltiumSchematicPoint(
      asPoint(schematicNetLabel.anchor_position) ??
        asPoint(schematicNetLabel.center) ?? { x: 0, y: 0 },
    )
    addSchematicRecord(
      createAltiumSchematicNetLabelRecordFields({
        altiumLabelPosition,
        labelText,
        symbolName: asString(schematicNetLabel.symbol_name),
      }),
      schematicRecordContext,
    )
  }

  for (const schematicPort of schematicElements.filter(
    (element) => element.type === "schematic_port",
  )) {
    const sourcePort = sourcePorts.get(asString(schematicPort.source_port_id))
    if (sourcePort?.do_not_connect !== true) continue
    const circuitPortPosition = asPoint(schematicPort.center)
    if (!circuitPortPosition) continue
    addSchematicRecord(
      createAltiumSchematicNoConnectRecordFields({
        altiumNoConnectPosition:
          circuitToAltiumSchematicPoint(circuitPortPosition),
      }),
      schematicRecordContext,
    )
  }

  for (const annotation of schematicElements) {
    const annotationRecordFields =
      createAltiumSchematicSheetAnnotationRecordFields({
        annotation,
        circuitToAltiumSchematicPoint,
        fontTable: altiumSchematicFontTable,
      })
    if (!annotationRecordFields) continue
    addSchematicRecord(annotationRecordFields, schematicRecordContext)
  }

  return `${schematicRecordContext.lines.join("\r\n")}\r\n`
}
