import type { SchSymbol, TextPrimitive } from "schematic-symbols"
import { symbols } from "schematic-symbols"
import { compose, translate } from "transformation-matrix"
import {
  type AltiumSchematicSymbolMapping,
  createAltiumSchematicGraphicRecordFields,
  createOwnedSchematicRecordFields,
  transformSchematicSymbolPoint,
} from "./create-altium-schematic-graphic-record-fields"
import { sanitizeField } from "./format"
import type { AltiumPartId, Point, PointTransform } from "./types"

type AltiumSchematicTextPlacement = {
  justification: number
  position: Point
}

const ALTIUM_JUSTIFICATION_BY_TEXT_ANCHOR = {
  bottom_left: 0,
  middle_bottom: 1,
  bottom_right: 2,
  middle_left: 3,
  center: 4,
  middle_right: 5,
  top_left: 6,
  middle_top: 7,
  top_right: 8,
} satisfies Record<TextPrimitive["anchor"], number>

export type AltiumSchematicSymbolRecords = {
  commentPlacement?: AltiumSchematicTextPlacement
  designatorPlacement?: AltiumSchematicTextPlacement
  graphicRecordFields: string[][]
}

type CreateAltiumSchematicSymbolRecordsOptions = {
  altiumComponentRecordIndex: number
  altiumPartId: AltiumPartId
  circuitComponentCenter: Point
  circuitToAltiumSchematicPoint: PointTransform
  symbolName: string
}

export function createAltiumSchematicSymbolRecords({
  altiumComponentRecordIndex,
  altiumPartId,
  circuitComponentCenter,
  circuitToAltiumSchematicPoint,
  symbolName,
}: CreateAltiumSchematicSymbolRecordsOptions):
  | AltiumSchematicSymbolRecords
  | undefined {
  const schematicSymbol = findSchematicSymbol(symbolName)
  if (!schematicSymbol) return undefined

  const symbolToCircuitMatrix = compose(
    translate(circuitComponentCenter.x, circuitComponentCenter.y),
    translate(-schematicSymbol.center.x, -schematicSymbol.center.y),
  )
  const symbolMapping: AltiumSchematicSymbolMapping = {
    altiumComponentRecordIndex,
    altiumPartId,
    circuitToAltiumSchematicPoint,
    symbolToCircuitMatrix,
  }
  const graphicRecordFields: string[][] = []
  let commentPlacement: AltiumSchematicTextPlacement | undefined
  let designatorPlacement: AltiumSchematicTextPlacement | undefined

  for (const primitive of schematicSymbol.primitives) {
    if (primitive.type !== "text") {
      graphicRecordFields.push(
        createAltiumSchematicGraphicRecordFields({
          graphicPrimitive: primitive,
          symbolMapping,
        }),
      )
      continue
    }

    const textPlacement = getAltiumTextPlacement({
      symbolMapping,
      textPrimitive: primitive,
    })
    if (primitive.text === "{REF}") {
      designatorPlacement = textPlacement
    } else if (primitive.text === "{VAL}") {
      commentPlacement = textPlacement
    } else {
      graphicRecordFields.push(
        createAltiumTextRecordFields({
          symbolMapping,
          textPrimitive: primitive,
        }),
      )
    }
  }

  return {
    commentPlacement,
    designatorPlacement,
    graphicRecordFields,
  }
}

function findSchematicSymbol(symbolName: string): SchSymbol | undefined {
  return Object.entries(symbols).find(
    ([registeredSymbolName]) => registeredSymbolName === symbolName,
  )?.[1]
}

function createAltiumTextRecordFields({
  symbolMapping,
  textPrimitive,
}: {
  symbolMapping: AltiumSchematicSymbolMapping
  textPrimitive: TextPrimitive
}): string[] {
  const placement = getAltiumTextPlacement({
    symbolMapping,
    textPrimitive,
  })
  return [
    "RECORD=4",
    ...createOwnedSchematicRecordFields({
      altiumComponentRecordIndex: symbolMapping.altiumComponentRecordIndex,
      altiumPartId: symbolMapping.altiumPartId,
    }),
    `LOCATION.X=${placement.position.x}`,
    `LOCATION.Y=${placement.position.y}`,
    "FONTID=2",
    `TEXT=${sanitizeField(textPrimitive.text)}`,
    "ORIENTATION=0",
    `JUSTIFICATION=${placement.justification}`,
  ]
}

function getAltiumTextPlacement({
  symbolMapping,
  textPrimitive,
}: {
  symbolMapping: AltiumSchematicSymbolMapping
  textPrimitive: TextPrimitive
}): AltiumSchematicTextPlacement {
  return {
    justification: ALTIUM_JUSTIFICATION_BY_TEXT_ANCHOR[textPrimitive.anchor],
    position: transformSchematicSymbolPoint({
      symbolMapping,
      symbolPoint: { x: textPrimitive.x, y: textPrimitive.y },
    }),
  }
}
