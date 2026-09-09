import { expect, test } from "bun:test"
import {
  board,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

test("uses an independent integer font for custom pin names while keeping numbers at 4 pt", async () => {
  const samples = [
    { size: undefined, points: "4" },
    { size: 0.15, points: "3" },
    { size: 0.155, points: "4" },
    { size: 0.4, points: "8" },
    { size: 0.01, points: "1" },
    { size: 0, points: "4" },
    { size: -1, points: "4" },
  ]
  const { schematics } = await extractArchive([
    board(),
    sourceComponent("chip", "U1"),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_chip",
      source_component_id: "chip",
      center: { x: 0, y: 0 },
      size: { width: 4, height: 8 },
    },
    ...samples.flatMap(({ size }, index) => [
      sourcePort({
        sourcePortId: `pin_${index}`,
        sourceComponentId: "chip",
        pinNumber: index + 1,
      }),
      {
        type: "schematic_port",
        schematic_port_id: `schematic_pin_${index}`,
        schematic_component_id: "schematic_chip",
        source_port_id: `pin_${index}`,
        center: { x: -2.5, y: index - 3 },
        distance_from_component_edge: 0.5,
        facing_direction: "left",
        display_pin_label: `SIGNAL_${index}`,
        display_pin_label_font_size: size,
      },
    ]),
  ])
  const doc = schematics[0]!
  const sheet = doc.getRecordsByKind("31")[0]!
  const pins = doc.getRecordsByKind("2")
  expect(pins).toHaveLength(samples.length)
  for (const [index, pin] of pins.entries()) {
    const nameFontId = pin.getNumber("NAME_CUSTOMFONTID")
    const numberFontId = pin.getNumber("DESIGNATOR_CUSTOMFONTID")
    expect(sheet.getCaseInsensitive(`SIZE${nameFontId}`)).toBe(
      samples[index]!.points,
    )
    expect(sheet.getCaseInsensitive(`SIZE${numberFontId}`)).toBe("4")
    expect(sheet.getDecoded(`FONTNAME${nameFontId}`)).toBe("Arial")
    expect(pin.getNumber("PINNAME_POSITIONCONGLOMERATE")! & 16).toBe(16)
    expect(pin.getNumber("PINDESIGNATOR_POSITIONCONGLOMERATE")).toBe(16)
  }
  expectValidSchematic(doc)
})
