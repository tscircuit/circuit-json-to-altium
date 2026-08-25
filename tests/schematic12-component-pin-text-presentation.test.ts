import { expect, test } from "bun:test"
import type { AltiumRecord } from "altiumts"
import { getSchematicTransform } from "../lib/get-schematic-transform"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"
import { getRecordLocation } from "./fixtures/altium-schematic-coordinate-utils"

function getFontSizePoints({
  fontId,
  sheetRecord,
}: {
  fontId: number | undefined
  sheetRecord: AltiumRecord
}): number | undefined {
  return sheetRecord.getNumber(`SIZE${fontId ?? 1}`)
}

test("preserves component and pin text presentation", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("source_capacitor", "C1"),
    sourcePort({
      sourcePortId: "source_port_1",
      sourceComponentId: "source_capacitor",
      pinNumber: 1,
    }),
    sourcePort({
      sourcePortId: "source_port_2",
      sourceComponentId: "source_capacitor",
      pinNumber: 2,
    }),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_capacitor",
      source_component_id: "source_capacitor",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 1 },
      symbol_display_value: "10uF",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_designator",
      schematic_component_id: "schematic_capacitor",
      text: "C1",
      position: { x: -0.8, y: 0.8 },
      font_size: 0.5,
      rotation: -90,
      anchor: "top_right",
      color: "#123456",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_value",
      schematic_component_id: "schematic_capacitor",
      text: "10uF",
      position: { x: 0.8, y: -0.8 },
      font_size: 0.45,
      rotation: 0,
      anchor: "center",
      color: "#654321",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_pin_name",
      schematic_component_id: "schematic_capacitor",
      text: "positive",
      position: { x: -0.9, y: 0 },
      font_size: 0.35,
      rotation: 0,
      anchor: "bottom_left",
      color: "#0a0b0c",
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_pin_number",
      schematic_component_id: "schematic_capacitor",
      text: "2",
      position: { x: 0.9, y: 0 },
      font_size: 0.4,
      rotation: 0,
      anchor: "bottom_right",
      color: "#0d0e0f",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_1",
      schematic_component_id: "schematic_capacitor",
      source_port_id: "source_port_1",
      center: { x: -1, y: 0 },
      facing_direction: "left",
      distance_from_component_edge: 0.2,
      display_pin_label: "positive",
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_port_2",
      schematic_component_id: "schematic_capacitor",
      source_port_id: "source_port_2",
      center: { x: 1, y: 0 },
      facing_direction: "right",
      distance_from_component_edge: 0.2,
      pin_number: 2,
    },
  ]
  const schematicElements = elements.filter(
    (element) => element.type?.startsWith("schematic_") === true,
  )
  const pointTransform = getSchematicTransform({
    schematicElements,
    schematicSheet: undefined,
  }).circuitToAltiumSchematicPoint
  const expectedDesignatorPosition = pointTransform({ x: -0.8, y: 0.8 })
  const expectedValuePosition = pointTransform({ x: 0.8, y: -0.8 })
  const expectedPinNamePosition = pointTransform({ x: -0.9, y: 0 })
  const expectedPinNumberPosition = pointTransform({ x: 0.9, y: 0 })

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const sheetRecord = schematic.getRecordsByKind("31")[0]
  const component = schematic.components[0]
  if (!sheetRecord || !component) {
    throw new Error("Expected a sheet record and one component")
  }
  const ownedRecords = schematic.getOwnedRecords(component)
  const designator = ownedRecords.find((record) => record.recordKind === "34")
  const value = ownedRecords.find((record) => record.recordKind === "41")
  const pins = ownedRecords.filter((record) => record.recordKind === "2")
  const pinTexts = ownedRecords.filter((record) => record.recordKind === "4")
  expect({
    designator: {
      color: designator?.getNumber("COLOR"),
      fontSizePoints: getFontSizePoints({
        fontId: designator?.getNumber("FONTID"),
        sheetRecord,
      }),
      justification: designator?.getNumber("JUSTIFICATION"),
      orientation: designator?.getNumber("ORIENTATION"),
      position: designator ? getRecordLocation(designator) : undefined,
    },
    pins: pins.map((pin) => ({
      color: pin.getNumber("COLOR"),
      pinConglomerate: pin.getNumber("PINCONGLOMERATE"),
    })),
    pinTexts: pinTexts.map((pinText) => ({
      color: pinText.getNumber("COLOR"),
      fontSizePoints: getFontSizePoints({
        fontId: pinText.getNumber("FONTID"),
        sheetRecord,
      }),
      justification: pinText.getNumber("JUSTIFICATION"),
      position: getRecordLocation(pinText),
      text: pinText.getDecoded("TEXT"),
    })),
    value: {
      color: value?.getNumber("COLOR"),
      fontSizePoints: getFontSizePoints({
        fontId: value?.getNumber("FONTID"),
        sheetRecord,
      }),
      justification: value?.getNumber("JUSTIFICATION"),
      orientation: value?.getNumber("ORIENTATION"),
      position: value ? getRecordLocation(value) : undefined,
    },
  }).toEqual({
    designator: {
      color: 0x56_34_12,
      fontSizePoints: 10,
      justification: 8,
      orientation: 1,
      position: expectedDesignatorPosition,
    },
    pins: [
      { color: 0x0c_0b_0a, pinConglomerate: 34 },
      { color: 0x0f_0e_0d, pinConglomerate: 32 },
    ],
    pinTexts: [
      {
        color: 0x0c_0b_0a,
        fontSizePoints: 7,
        justification: 0,
        position: expectedPinNamePosition,
        text: "positive",
      },
      {
        color: 0x0f_0e_0d,
        fontSizePoints: 8,
        justification: 2,
        position: expectedPinNumberPosition,
        text: "2",
      },
    ],
    value: {
      color: 0x21_43_65,
      fontSizePoints: 9,
      justification: 4,
      orientation: 0,
      position: expectedValuePosition,
    },
  })
  expectValidSchematic(schematic)
})
