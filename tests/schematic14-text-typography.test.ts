import { expect, test } from "bun:test"
import { type AltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

test("preserves schematic text font family, weight, and style", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_text",
      schematic_text_id: "imported_title",
      text: "Imported title",
      font_size: 0.6,
      font_family: "Times New Roman",
      font_weight: "bold",
      font_style: "italic",
      position: { x: 0, y: 0 },
      rotation: 0,
      anchor: "top_left",
      color: "#000000",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const sheetRecord = schematic.getRecordsByKind("31")[0]
  const label = schematic.getRecordsByKind("4")[0]
  const fontId = label?.getNumber("FONTID")

  expect(fontId).toBeDefined()
  expect({
    family: sheetRecord?.getDecoded(`FONTNAME${fontId}`),
    isBold: sheetRecord?.getBoolean(`BOLD${fontId}`),
    isItalic: sheetRecord?.getBoolean(`ITALIC${fontId}`),
    sizePoints: sheetRecord?.getNumber(`SIZE${fontId}`),
  }).toEqual({
    family: "Times New Roman",
    isBold: true,
    isItalic: true,
    sizePoints: 12,
  })
  expectValidSchematic(schematic)
  await expect(serializeAltiumSheetToSvg(schematic)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
