import { getAltiumColorFromCss } from "./altium-color"
import {
  ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
  ALTIUM_SCHEMATIC_SHEET_AREA_COLOR,
} from "./altium-schematic-colors"
import { createAltiumSchematicComponentParameterRecordFields } from "./create-altium-schematic-component-parameter-record-fields"
import { createAltiumSchematicFontTable } from "./create-altium-schematic-font-table"
import { createAltiumSchematicNetLabelRecordFields } from "./create-altium-schematic-net-label-record-fields"
import { createAltiumSchematicNoConnectRecordFields } from "./create-altium-schematic-no-connect-record-fields"
import { createAltiumSchematicOffSheetPortRecordFields } from "./create-altium-schematic-off-sheet-port-record-fields"
import { createAltiumSchematicSheetAnnotationRecordFields } from "./create-altium-schematic-sheet-annotation-record-fields"
import {
  type AltiumSchematicChildSheet,
  createAltiumSchematicSheetEntryNoConnectRecordFields,
  createAltiumSchematicSheetSymbolOwnedRecordFields,
  createAltiumSchematicSheetSymbolPlans,
  createAltiumSchematicSheetSymbolRecordFields,
} from "./create-altium-schematic-sheet-symbol-records"
import { createAltiumSchematicSymbolPrimitiveRecordFields } from "./create-altium-schematic-symbol-primitive-record-fields"
import { createAltiumSchematicSymbolRecords } from "./create-altium-schematic-symbol-records"
import { createAltiumSchematicTextRecordFields } from "./create-altium-schematic-text-record-fields"
import { findSchematicComponentText } from "./find-schematic-component-text"
import { findSchematicTextPresentation } from "./find-schematic-text-presentation"
import {
  asNumber,
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  isCircuitElement,
  sanitizeField,
} from "./format"
import { getAltiumSchematicTextPresentation } from "./get-altium-schematic-text-presentation"
import { getSchematicTransform } from "./get-schematic-transform"
import { isSchematicSheetAnnotation } from "./is-schematic-sheet-annotation"
import { isSchematicSymbolPrimitive } from "./is-schematic-symbol-primitive"
import type {
  CircuitElement,
  Point,
  PointTransform,
  SchematicComponentId,
  SchematicSheetId,
  SchematicSymbolId,
  SourceComponentId,
  SourcePortId,
} from "./types"

type CreateSchematicDocumentParams = {
  childSheets?: AltiumSchematicChildSheet[]
  circuitJson: CircuitElement[]
  includeAllSchematicElements: boolean
  schematicSheetId: SchematicSheetId | undefined
}

type SchematicSheetMembershipParams = {
  element: CircuitElement
  includeAllSchematicElements: boolean
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

type SchematicSymbolPrimitiveMaps = {
  byComponentId: Map<SchematicComponentId, CircuitElement[]>
  bySymbolId: Map<SchematicSymbolId, CircuitElement[]>
}

const ALTIUM_PIN_STANDARD_FLAGS = 0x20
const ALTIUM_PIN_NAME_VISIBLE_FLAG = 0x08
const ALTIUM_PIN_DESIGNATOR_VISIBLE_FLAG = 0x10
const ALTIUM_PIN_CLOCK_SYMBOL = 3
const ALTIUM_PIN_INVERSION_SYMBOL = 1
const ALTIUM_SCHEMATIC_DEFAULT_COLOR = 0x37_29_1f
const ALTIUM_SCHEMATIC_FALLBACK_BODY_COLOR = 0xc2_ffff
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

function appendElementToIdMap<OwnerId extends string>({
  element,
  id,
  map,
}: {
  element: CircuitElement
  id: OwnerId
  map: Map<OwnerId, CircuitElement[]>
}): void {
  if (!id) return
  map.set(id, [...(map.get(id) ?? []), element])
}

function createSchematicSymbolPrimitiveMaps(
  schematicElements: CircuitElement[],
): SchematicSymbolPrimitiveMaps {
  const maps: SchematicSymbolPrimitiveMaps = {
    byComponentId: new Map<SchematicComponentId, CircuitElement[]>(),
    bySymbolId: new Map<SchematicSymbolId, CircuitElement[]>(),
  }
  for (const primitive of schematicElements.filter(
    isSchematicSymbolPrimitive,
  )) {
    appendElementToIdMap({
      element: primitive,
      id: asString(primitive.schematic_component_id),
      map: maps.byComponentId,
    })
    appendElementToIdMap({
      element: primitive,
      id: asString(primitive.schematic_symbol_id),
      map: maps.bySymbolId,
    })
  }
  return maps
}

function getSchematicSymbolPrimitives({
  maps,
  schematicComponent,
}: {
  maps: SchematicSymbolPrimitiveMaps
  schematicComponent: CircuitElement
}): CircuitElement[] {
  const schematicComponentId = asString(
    schematicComponent.schematic_component_id,
  )
  const declaredSchematicSymbolId = asString(
    schematicComponent.schematic_symbol_id,
  )
  const allComponentPrimitives =
    maps.byComponentId.get(schematicComponentId) ?? []
  const componentPrimitives = allComponentPrimitives.filter((primitive) => {
    const primitiveSymbolId = asString(primitive.schematic_symbol_id)
    return (
      !declaredSchematicSymbolId ||
      !primitiveSymbolId ||
      primitiveSymbolId === declaredSchematicSymbolId
    )
  })
  const associatedSchematicSymbolIds = new Set(
    declaredSchematicSymbolId
      ? [declaredSchematicSymbolId]
      : allComponentPrimitives
          .map((primitive) => asString(primitive.schematic_symbol_id))
          .filter(Boolean),
  )
  const symbolPrimitives = [...associatedSchematicSymbolIds].flatMap(
    (schematicSymbolId) => maps.bySymbolId.get(schematicSymbolId) ?? [],
  )
  return [...new Set([...componentPrimitives, ...symbolPrimitives])]
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
  includeAllSchematicElements,
  schematicSheetId,
}: SchematicSheetMembershipParams): boolean {
  const elementSchematicSheetId = asString(element.schematic_sheet_id)
  return schematicSheetId
    ? elementSchematicSheetId === schematicSheetId ||
        (includeAllSchematicElements && !elementSchematicSheetId)
    : !elementSchematicSheetId || includeAllSchematicElements
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
  childSheets = [],
  circuitJson,
  includeAllSchematicElements,
  schematicSheetId,
}: CreateSchematicDocumentParams): string {
  const sourcePorts = new Map<SourcePortId, CircuitElement>(
    byType(circuitJson, "source_port").map((sourcePort) => [
      asString(sourcePort.source_port_id),
      sourcePort,
    ]),
  )
  const schematicElements = circuitJson.filter(
    (element) =>
      element.type?.startsWith("schematic_") === true &&
      element.type !== "schematic_sheet" &&
      !(
        element.type === "schematic_port" &&
        !asString(element.schematic_component_id) &&
        element.is_connected === false &&
        sourcePorts.get(asString(element.source_port_id))?.do_not_connect !==
          true
      ) &&
      doesElementBelongToSchematicSheet({
        element,
        includeAllSchematicElements,
        schematicSheetId,
      }),
  )
  const {
    circuitToAltiumSchematicLength,
    circuitToAltiumSchematicPoint,
    circuitToAltiumSchematicPrecisePoint,
    width: contentWidth,
    height: contentHeight,
  } = getSchematicTransform(schematicElements)
  const sheetSymbolPlans = createAltiumSchematicSheetSymbolPlans({
    childSheets,
    circuitJson,
  })
  const hasRenderableSchematicContent = schematicElements.some(
    (element) =>
      element.type !== "schematic_graphic" &&
      element.type !== "schematic_group" &&
      element.type !== "schematic_symbol",
  )
  const explicitlyPositionedSheetSymbolComponents = new Set(
    sheetSymbolPlans.flatMap((plan) =>
      plan.placementComponent ? [plan.placementComponent] : [],
    ),
  )
  const automaticallyPlacedSheetSymbolPlans = sheetSymbolPlans.filter(
    (plan) => !plan.placementComponent,
  )
  const sheetSymbolColumnCount = Math.max(
    Math.ceil(Math.sqrt(automaticallyPlacedSheetSymbolPlans.length)),
    1,
  )
  const sheetSymbolRowCount = Math.ceil(
    automaticallyPlacedSheetSymbolPlans.length / sheetSymbolColumnCount,
  )
  const sheetSymbolColumnWidth = Math.max(
    ...automaticallyPlacedSheetSymbolPlans.map((plan) => plan.width),
    0,
  )
  const sheetSymbolRowHeight = Math.max(
    ...automaticallyPlacedSheetSymbolPlans.map((plan) => plan.height),
    0,
  )
  const sheetSymbolStartX = hasRenderableSchematicContent
    ? contentWidth + 40
    : 60
  const sheetSymbolLayoutWidth =
    sheetSymbolColumnCount * sheetSymbolColumnWidth +
    Math.max(sheetSymbolColumnCount - 1, 0) * 40
  const sheetSymbolLayoutHeight =
    sheetSymbolRowCount * sheetSymbolRowHeight +
    Math.max(sheetSymbolRowCount - 1, 0) * 40
  const altiumSheetWidth = Math.max(
    contentWidth,
    automaticallyPlacedSheetSymbolPlans.length > 0
      ? sheetSymbolStartX + sheetSymbolLayoutWidth + 60
      : 0,
  )
  const altiumSheetHeight = Math.max(
    contentHeight,
    automaticallyPlacedSheetSymbolPlans.length > 0
      ? sheetSymbolLayoutHeight + 120
      : 0,
  )
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
      `AREACOLOR=${ALTIUM_SCHEMATIC_SHEET_AREA_COLOR}`,
      `CUSTOMX=${altiumSheetWidth}`,
      `CUSTOMY=${altiumSheetHeight}`,
      "USECUSTOMSHEET=T",
      "SNAPGRIDON=T",
      "SNAPGRIDSIZE=10",
    ],
    schematicRecordContext,
  )

  let automaticallyPlacedPlanIndex = 0
  for (const plan of sheetSymbolPlans) {
    let placedPlan = plan
    let location: Point
    if (plan.placementComponent) {
      const circuitCenter = asPoint(plan.placementComponent.center) ?? {
        x: 0,
        y: 0,
      }
      const circuitSize = isCircuitElement(plan.placementComponent.size)
        ? plan.placementComponent.size
        : {}
      const width = circuitToAltiumSchematicLength(
        asPositiveNumber(circuitSize.width, plan.width / 20),
      )
      const height = circuitToAltiumSchematicLength(
        asPositiveNumber(circuitSize.height, plan.height / 20),
      )
      const altiumCenter = circuitToAltiumSchematicPoint(circuitCenter)
      location = {
        x: altiumCenter.x - width / 2,
        y: altiumCenter.y + height / 2,
      }
      placedPlan = { ...plan, height, width }
    } else {
      const columnIndex = automaticallyPlacedPlanIndex % sheetSymbolColumnCount
      const rowIndex = Math.floor(
        automaticallyPlacedPlanIndex / sheetSymbolColumnCount,
      )
      location = {
        x: sheetSymbolStartX + columnIndex * (sheetSymbolColumnWidth + 40),
        y: altiumSheetHeight - 60 - rowIndex * (sheetSymbolRowHeight + 40),
      }
      automaticallyPlacedPlanIndex++
    }
    const altiumSymbolRecordIndex = addSchematicRecord(
      createAltiumSchematicSheetSymbolRecordFields({
        location,
        plan: placedPlan,
      }),
      schematicRecordContext,
    )
    for (const recordFields of createAltiumSchematicSheetSymbolOwnedRecordFields(
      {
        altiumSymbolRecordIndex,
        location,
        plan: placedPlan,
      },
    )) {
      addSchematicRecord(recordFields, schematicRecordContext)
    }
    for (const recordFields of createAltiumSchematicSheetEntryNoConnectRecordFields(
      {
        location,
        plan: placedPlan,
      },
    )) {
      addSchematicRecord(recordFields, schematicRecordContext)
    }
  }

  const sourceComponents = new Map<SourceComponentId, CircuitElement>(
    byType(circuitJson, "source_component")
      .filter((element) => typeof element.source_component_id === "string")
      .map((element) => [asString(element.source_component_id), element]),
  )
  const schematicSymbols = new Map<SchematicSymbolId, CircuitElement>(
    byType(circuitJson, "schematic_symbol").map((schematicSymbol) => [
      asString(schematicSymbol.schematic_symbol_id),
      schematicSymbol,
    ]),
  )
  const schematicPortsByComponentId = new Map<
    SchematicComponentId,
    CircuitElement[]
  >()
  const schematicTextsByComponentId = new Map<
    SchematicComponentId,
    CircuitElement[]
  >()
  const sheetTexts = schematicElements.filter(
    (element) =>
      element.type === "schematic_text" && isSchematicSheetAnnotation(element),
  )
  const consumedSheetTexts = new Set<CircuitElement>()
  const schematicSymbolPrimitiveMaps =
    createSchematicSymbolPrimitiveMaps(schematicElements)
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
  for (const schematicText of schematicElements.filter(
    (element) =>
      element.type === "schematic_text" && !isSchematicSymbolPrimitive(element),
  )) {
    appendElementToIdMap({
      element: schematicText,
      id: asString(schematicText.schematic_component_id),
      map: schematicTextsByComponentId,
    })
  }

  for (const [componentNumber, schematicComponent] of schematicElements
    .filter(
      (element) =>
        element.type === "schematic_component" &&
        !explicitlyPositionedSheetSymbolComponents.has(element),
    )
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
    const schematicComponentId = asString(
      schematicComponent.schematic_component_id,
    )
    const componentTexts =
      schematicTextsByComponentId.get(schematicComponentId) ?? []
    const designatorText = findSchematicComponentText({
      componentTexts,
      excludedText: undefined,
      renderedText: designator,
    })
    const commentText = findSchematicComponentText({
      componentTexts,
      excludedText: designatorText,
      renderedText: componentComment,
    })
    const componentGraphicTexts = componentTexts.filter(
      (componentText) =>
        componentText !== designatorText && componentText !== commentText,
    )
    const hasExplicitComponentTextPresentation = componentTexts.length > 0
    const schematicSymbol = schematicSymbols.get(
      asString(schematicComponent.schematic_symbol_id),
    )
    const libraryReference =
      sanitizeField(schematicSymbol?.name) ||
      sanitizeField(schematicComponent.symbol_name) ||
      designator
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
    const customSymbolPrimitiveRecordFields = getSchematicSymbolPrimitives({
      maps: schematicSymbolPrimitiveMaps,
      schematicComponent,
    }).flatMap((graphic) => {
      const recordFields = createAltiumSchematicSymbolPrimitiveRecordFields({
        altiumComponentRecordIndex,
        circuitToAltiumSchematicLength,
        circuitToAltiumSchematicPoint,
        fontTable: altiumSchematicFontTable,
        graphic,
      })
      return recordFields ? [recordFields] : []
    })
    const hasCustomSymbolPrimitives =
      customSymbolPrimitiveRecordFields.length > 0
    const shouldHideInferredDesignator =
      !designatorText &&
      (hasExplicitComponentTextPresentation || hasCustomSymbolPrimitives)
    const schematicSymbolRecords = !hasCustomSymbolPrimitives
      ? createAltiumSchematicSymbolRecords({
          altiumComponentRecordIndex,
          circuitComponentCenter,
          circuitToAltiumSchematicPoint,
          circuitToAltiumSchematicPrecisePoint,
          symbolName: asString(schematicComponent.symbol_name),
        })
      : undefined
    if (hasCustomSymbolPrimitives) {
      for (const primitiveRecordFields of customSymbolPrimitiveRecordFields) {
        addSchematicRecord(primitiveRecordFields, schematicRecordContext)
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
          `AREACOLOR=${ALTIUM_SCHEMATIC_FALLBACK_BODY_COLOR}`,
          "ISSOLID=T",
        ],
        schematicRecordContext,
      )
    }
    const designatorPlacement = schematicSymbolRecords?.designatorPlacement
    const commentPlacement = schematicSymbolRecords?.commentPlacement
    const designatorPresentation = getAltiumSchematicTextPresentation({
      circuitToAltiumSchematicPoint,
      fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR,
      fallbackAltiumPosition: designatorPlacement?.position ?? {
        x: fallbackSchematicBoxBounds.left,
        y: fallbackSchematicBoxBounds.top + 12,
      },
      fallbackFontId: 1,
      fallbackJustification: designatorPlacement?.justification ?? 0,
      fontTable: altiumSchematicFontTable,
      schematicText: designatorText,
    })
    const commentPresentation = getAltiumSchematicTextPresentation({
      circuitToAltiumSchematicPoint,
      fallbackAltiumColor: ALTIUM_SCHEMATIC_DEFAULT_COLOR,
      fallbackAltiumPosition: commentPlacement?.position ?? {
        x: fallbackSchematicBoxBounds.left,
        y: fallbackSchematicBoxBounds.bottom - 12,
      },
      fallbackFontId: 2,
      fallbackJustification: commentPlacement?.justification ?? 0,
      fontTable: altiumSchematicFontTable,
      schematicText: commentText,
    })
    addSchematicRecord(
      [
        "RECORD=34",
        `OWNERINDEX=${altiumComponentRecordIndex}`,
        "OWNERPARTID=-1",
        `LOCATION.X=${designatorPresentation.position.x}`,
        `LOCATION.Y=${designatorPresentation.position.y}`,
        `FONTID=${designatorPresentation.fontId}`,
        "NAME=Designator",
        `TEXT=${designator}`,
        `COLOR=${designatorPresentation.color}`,
        "SHOWNAME=F",
        `ISHIDDEN=${shouldHideInferredDesignator ? "T" : "F"}`,
        `ORIENTATION=${designatorPresentation.orientation}`,
        `JUSTIFICATION=${designatorPresentation.justification}`,
      ],
      schematicRecordContext,
    )
    addSchematicRecord(
      [
        "RECORD=41",
        `OWNERINDEX=${altiumComponentRecordIndex}`,
        "OWNERPARTID=-1",
        `LOCATION.X=${commentPresentation.position.x}`,
        `LOCATION.Y=${commentPresentation.position.y}`,
        `FONTID=${commentPresentation.fontId}`,
        "NAME=Comment",
        `TEXT=${componentComment}`,
        `COLOR=${commentPresentation.color}`,
        "SHOWNAME=F",
        `ISHIDDEN=${componentComment ? "F" : "T"}`,
        `ORIENTATION=${commentPresentation.orientation}`,
        `JUSTIFICATION=${commentPresentation.justification}`,
      ],
      schematicRecordContext,
    )
    for (const parameterRecordFields of createAltiumSchematicComponentParameterRecordFields(
      {
        altiumComponentRecordIndex,
        altiumPosition: altiumComponentCenter,
        sourceComponent,
      },
    )) {
      addSchematicRecord(parameterRecordFields, schematicRecordContext)
    }

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
      const altiumPinOrientation =
        ALTIUM_PIN_ORIENTATION_BY_FACING_DIRECTION[facingDirection] ?? 2
      const isPinTextVisibleByDefault =
        !schematicSymbolRecords && !hasCustomSymbolPrimitives
      const pinName =
        sanitizeField(schematicPort.display_pin_label) ||
        sanitizeField(sourcePort?.name) ||
        `Pin ${pinIndex + 1}`
      const pinDesignator =
        sanitizeField(sourcePort?.pin_number) || `${pinIndex + 1}`
      const pinGeometryLabels = [
        asString(schematicPort.display_pin_label),
        asString(sourcePort?.name),
        ...(Array.isArray(sourcePort?.port_hints)
          ? sourcePort.port_hints.flatMap((portHint) =>
              typeof portHint === "string" ? [portHint] : [],
            )
          : []),
        pinDesignator,
      ]
      const altiumPinTerminal =
        circuitToAltiumSchematicPoint(circuitPinTerminal)
      const builtinPinGeometry =
        schematicSymbolRecords?.pinGeometryByTerminal.get(
          `${altiumPinTerminal.x}:${altiumPinTerminal.y}`,
        ) ??
        pinGeometryLabels
          .map((label) => schematicSymbolRecords?.pinGeometryByLabel.get(label))
          .find((pinGeometry) => pinGeometry !== undefined)
      const altiumPinLocation =
        builtinPinGeometry?.location ??
        (schematicSymbolRecords
          ? circuitToAltiumSchematicPoint(circuitPinTerminal)
          : boxedSchematicPinGeometry.location)
      const altiumPinLength =
        builtinPinGeometry?.length ??
        (schematicSymbolRecords ? 10 : boxedSchematicPinGeometry.length)
      const pinNameText =
        typeof schematicPort.display_pin_label === "string"
          ? findSchematicComponentText({
              componentTexts: componentGraphicTexts,
              excludedText: undefined,
              renderedText: pinName,
            })
          : undefined
      const pinNumberText =
        typeof schematicPort.pin_number === "number"
          ? findSchematicComponentText({
              componentTexts: componentGraphicTexts,
              excludedText: pinNameText,
              renderedText: pinDesignator,
            })
          : undefined
      const hasVisibleCustomPinName =
        hasCustomSymbolPrimitives &&
        typeof schematicPort.display_pin_label === "string"
      const hasVisibleRegularPinName =
        !hasCustomSymbolPrimitives &&
        (hasExplicitComponentTextPresentation
          ? typeof schematicPort.display_pin_label === "string"
          : isPinTextVisibleByDefault)
      const isPinNameVisible =
        pinNameText === undefined &&
        (hasVisibleCustomPinName || hasVisibleRegularPinName)
      const isPinNumberVisible =
        pinNumberText === undefined &&
        !hasCustomSymbolPrimitives &&
        (hasExplicitComponentTextPresentation
          ? typeof schematicPort.pin_number === "number"
          : isPinTextVisibleByDefault)
      const altiumPinTextVisibilityFlags =
        (isPinNameVisible ? ALTIUM_PIN_NAME_VISIBLE_FLAG : 0) |
        (isPinNumberVisible ? ALTIUM_PIN_DESIGNATOR_VISIBLE_FLAG : 0)
      const altiumPinConglomerate =
        ALTIUM_PIN_STANDARD_FLAGS |
        altiumPinTextVisibilityFlags |
        altiumPinOrientation
      const explicitPinText = pinNameText ?? pinNumberText
      const pinColor = getAltiumColorFromCss({
        cssColor: asString(explicitPinText?.color),
        fallbackAltiumColor: ALTIUM_SCHEMATIC_GRAPHIC_COLOR,
      })
      addSchematicRecord(
        [
          "RECORD=2",
          `OWNERINDEX=${altiumComponentRecordIndex}`,
          "OWNERPARTID=1",
          `DESIGNATOR=${pinDesignator}`,
          `NAME=${pinName}`,
          `PINCONGLOMERATE=${altiumPinConglomerate}`,
          `LOCATION.X=${altiumPinLocation.x}`,
          `LOCATION.Y=${altiumPinLocation.y}`,
          `PINLENGTH=${altiumPinLength}`,
          ...(schematicPort.has_input_arrow === true
            ? [`SYMBOL_INNEREDGE=${ALTIUM_PIN_CLOCK_SYMBOL}`]
            : []),
          ...(schematicPort.is_drawn_with_inversion_circle === true
            ? [`SYMBOL_OUTEREDGE=${ALTIUM_PIN_INVERSION_SYMBOL}`]
            : []),
          `COLOR=${pinColor}`,
          "FONTID=2",
        ],
        schematicRecordContext,
      )
    }
    for (const componentGraphicText of componentGraphicTexts) {
      const recordFields = createAltiumSchematicTextRecordFields({
        altiumComponentRecordIndex,
        circuitToAltiumSchematicPoint,
        fontTable: altiumSchematicFontTable,
        schematicText: componentGraphicText,
      })
      if (recordFields) addSchematicRecord(recordFields, schematicRecordContext)
    }
  }

  for (const schematicPort of schematicElements.filter(
    (element) =>
      element.type === "schematic_port" &&
      !asString(element.schematic_component_id),
  )) {
    const sourcePort = sourcePorts.get(asString(schematicPort.source_port_id))
    const isStandaloneNoConnectMarker =
      sourcePort?.do_not_connect === true &&
      schematicPort.is_internal_circuit_port !== true
    if (isStandaloneNoConnectMarker) continue
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
    const circuitLabelPosition = asPoint(schematicNetLabel.anchor_position) ??
      asPoint(schematicNetLabel.center) ?? { x: 0, y: 0 }
    const textPresentation = findSchematicTextPresentation({
      excludedTexts: consumedSheetTexts,
      renderedText: labelText,
      schematicTexts: sheetTexts,
      targetPosition: circuitLabelPosition,
    })
    if (textPresentation) consumedSheetTexts.add(textPresentation)
    addSchematicRecord(
      createAltiumSchematicNetLabelRecordFields({
        anchorSide: asString(schematicNetLabel.anchor_side),
        altiumLabelPosition:
          circuitToAltiumSchematicPoint(circuitLabelPosition),
        fontTable: altiumSchematicFontTable,
        labelText,
        symbolName: asString(schematicNetLabel.symbol_name),
        textPresentation,
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
    if (consumedSheetTexts.has(annotation)) continue
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
