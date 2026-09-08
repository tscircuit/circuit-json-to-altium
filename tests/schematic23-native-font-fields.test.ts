import { expect, test } from "bun:test"
import { serializeAltiumSheetToSvg } from "altiumts"
import { board, extractArchive, sourceComponent, sourcePort } from "./fixtures"

test("encodes fractional annotation font sizes without triggering native fallback", async () => {
  const { schematics } = await extractArchive([
    board(),
    ...[0.12, 0.18, 0.2].map((fontSize, index) => ({
      type: "schematic_text",
      schematic_text_id: `text-${index}`,
      position: { x: index * 2, y: 0 },
      text: `FONT_${index}`,
      font_size: fontSize,
      anchor: "center",
    })),
  ])
  const doc = schematics[0]!
  const sheet = doc.getRecordsByKind("31")[0]!
  const svg = serializeAltiumSheetToSvg(doc)
  for (const [index, expected] of [2.4, 3.6, 4].entries()) {
    const record = doc
      .getRecordsByKind("4")
      .find((label) => label.getDecoded("TEXT") === `FONT_${index}`)!
    const fontId = record.getNumber("FONTID")!
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toMatch(/^\d+$/u)
    const size =
      sheet.getNumber(`SIZE${fontId}`)! +
      (sheet.getNumber(`SIZE${fontId}_FRAC`) ?? 0) / 100_000
    expect(size).toBeCloseTo(expected, 5)
    const text = svg.match(
      new RegExp(`<text\\b[^>]*>FONT_${index}</text>`, "u"),
    )?.[0]
    expect(text).toContain(`font-size="${expected}"`)
    expect(text).toContain('font-family="Arial"')
  }
})

test("exports native custom fonts for both visible pin names and numbers", async () => {
  const { schematics } = await extractArchive([
    board(),
    sourceComponent("u", "U1"),
    sourcePort({ sourcePortId: "p", sourceComponentId: "u", pinNumber: 1 }),
    {
      type: "schematic_component",
      schematic_component_id: "sch-u",
      source_component_id: "u",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "sch-p",
      schematic_component_id: "sch-u",
      source_port_id: "p",
      center: { x: -1.5, y: 0 },
      facing_direction: "left",
      distance_from_component_edge: 0.5,
      display_pin_label: "SIGNAL",
      pin_number: 1,
    },
  ])
  const doc = schematics[0]!
  const pin = doc.getRecordsByKind("2")[0]!
  for (const kind of ["NAME", "DESIGNATOR"]) {
    expect(pin.getNumber(`PIN${kind}_POSITIONCONGLOMERATE`)! & 16).toBe(16)
    expect(pin.getNumber(`${kind}_CUSTOMFONTID`)).toBe(2)
  }
  expect(pin.getCaseInsensitive("FONTID")).toBeUndefined()
  const texts = serializeAltiumSheetToSvg(doc)
    .match(/<g data-record="2">.*?<\/g>/u)?.[0]
    ?.match(/<text\b[^>]*>.*?<\/text>/gu)
  expect(texts).toHaveLength(2)
  for (const text of texts ?? []) {
    expect(text).toContain('font-size="4"')
    expect(text).toContain('font-family="Arial"')
  }
})
