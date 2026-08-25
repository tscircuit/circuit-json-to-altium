import type { AltiumSchDoc, AltiumSchPinRecord } from "altiumts"
import type { CircuitElement, SchematicComponentId } from "../../lib/types"
import {
  getRecordLocation,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"
import { getAltiumSchematicFont } from "./get-altium-schematic-text-frame-lines"
import { getCssColorFromAltiumRecord } from "./get-css-color-from-altium-record"

type AppendAltiumSchematicPinTextElementsInput = {
  componentIndex: number
  document: AltiumSchDoc
  elements: CircuitElement[]
  pin: AltiumSchPinRecord
  pinIndex: number
  schematicComponentId: SchematicComponentId
}

type SchematicTextAnchor = "bottom_left" | "bottom_right"

const ALTIUM_PIN_NAME_VISIBLE_FLAG = 0x08
const ALTIUM_PIN_NUMBER_VISIBLE_FLAG = 0x10
const ALTIUM_PIN_TEXT_OFFSET = 2

const PIN_DIRECTION_BY_ORIENTATION = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const

function getPinOrientation(pin: AltiumSchPinRecord): number {
  const pinConglomerate = pin.getNumber("PINCONGLOMERATE")
  const orientation = pinConglomerate ?? pin.getNumber("ORIENTATION") ?? 0
  return ((Math.round(orientation) % 4) + 4) % 4
}

function appendPinText({
  anchor,
  componentIndex,
  elements,
  fontSizeCircuitUnits,
  pinColor,
  pinIndex,
  position,
  rotationDegrees,
  schematicComponentId,
  text,
  textKind,
}: {
  anchor: SchematicTextAnchor
  componentIndex: number
  elements: CircuitElement[]
  fontSizeCircuitUnits: number
  pinColor: string
  pinIndex: number
  position: { x: number; y: number }
  rotationDegrees: number
  schematicComponentId: SchematicComponentId
  text: string
  textKind: "name" | "number"
}): void {
  if (!text) return
  elements.push({
    type: "schematic_text",
    schematic_text_id: `schematic_text_component_${componentIndex}_pin_${pinIndex}_${textKind}`,
    schematic_component_id: schematicComponentId,
    text,
    anchor,
    color: pinColor,
    font_size: fontSizeCircuitUnits,
    position,
    rotation: rotationDegrees,
  })
}

export function appendAltiumSchematicPinTextElements({
  componentIndex,
  document,
  elements,
  pin,
  pinIndex,
  schematicComponentId,
}: AppendAltiumSchematicPinTextElementsInput): void {
  const orientation = getPinOrientation(pin)
  const direction = PIN_DIRECTION_BY_ORIENTATION[orientation] ?? {
    x: 1,
    y: 0,
  }
  const pinConglomerate = pin.getNumber("PINCONGLOMERATE")
  const isNameVisible =
    pinConglomerate === undefined ||
    (pinConglomerate & ALTIUM_PIN_NAME_VISIBLE_FLAG) !== 0
  const isNumberVisible =
    pinConglomerate === undefined ||
    (pinConglomerate & ALTIUM_PIN_NUMBER_VISIBLE_FLAG) !== 0
  const pinPosition = getRecordLocation(pin)
  const pinFont = getAltiumSchematicFont({
    document,
    fallbackSizePoints: 9,
    record: pin,
  })
  const pinColor = getCssColorFromAltiumRecord({
    fallbackCssColor: "#1f2937",
    fieldNames: ["COLOR"],
    record: pin,
  })
  const rotationDegrees = orientation === 1 || orientation === 3 ? -90 : 0
  const directionMatchesText = orientation === 0 || orientation === 1
  const designatorAnchor: SchematicTextAnchor = directionMatchesText
    ? "bottom_left"
    : "bottom_right"
  const nameAnchor: SchematicTextAnchor = directionMatchesText
    ? "bottom_right"
    : "bottom_left"

  if (isNumberVisible) {
    appendPinText({
      anchor: designatorAnchor,
      componentIndex,
      elements,
      fontSizeCircuitUnits: toCircuitLength(pinFont.sizePoints),
      pinColor,
      pinIndex,
      position: toCircuitPoint({
        x: pinPosition.x + direction.x * ALTIUM_PIN_TEXT_OFFSET,
        y: pinPosition.y + direction.y * ALTIUM_PIN_TEXT_OFFSET,
      }),
      rotationDegrees,
      schematicComponentId,
      text: pin.designator ?? "",
      textKind: "number",
    })
  }
  if (isNameVisible) {
    appendPinText({
      anchor: nameAnchor,
      componentIndex,
      elements,
      fontSizeCircuitUnits: toCircuitLength(pinFont.sizePoints),
      pinColor,
      pinIndex,
      position: toCircuitPoint({
        x: pinPosition.x - direction.x * ALTIUM_PIN_TEXT_OFFSET,
        y: pinPosition.y - direction.y * ALTIUM_PIN_TEXT_OFFSET,
      }),
      rotationDegrees,
      schematicComponentId,
      text: pin.name ?? "",
      textKind: "name",
    })
  }
}
