import { expect, test } from "bun:test"
import { board, expectValidSchematic, extractArchive } from "./fixtures"

test("uses native integer net-label sizes without resizing other sheet text", async () => {
  const samples = [
    { text: "DEFAULT", size: undefined, points: "4" },
    { text: "FRACTIONAL", size: 0.22, points: "5" },
    { text: "CUSTOM", size: 0.5, points: "10" },
    { text: "SMALL", size: 0.01, points: "1" },
  ]
  const { schematics } = await extractArchive([
    board(),
    ...samples.flatMap(({ text, size }, index) => {
      const position = { x: index * 4, y: 0 }
      return [
        {
          type: "schematic_net_label",
          schematic_net_label_id: `label_${index}`,
          source_net_id: `net_${index}`,
          text,
          anchor_position: position,
          center: { x: position.x + 0.5, y: 0 },
          anchor_side: "left",
        },
        ...(size === undefined
          ? []
          : [
              {
                type: "schematic_text",
                schematic_text_id: `presentation_${index}`,
                text,
                font_size: size,
                position,
                anchor: "left",
              },
            ]),
      ]
    }),
    {
      type: "schematic_text",
      schematic_text_id: "unrelated_note",
      text: "NOTE",
      font_size: 0.22,
      position: { x: 0, y: 4 },
      anchor: "left",
    },
  ])
  const schematic = schematics[0]!
  const sheet = schematic.getRecordsByKind("31")[0]!

  for (const { text, points } of samples) {
    const records = schematic.records.filter(
      (record) => record.getDecoded("TEXT") === text,
    )
    expect(records.map((record) => record.recordKind)).toEqual(["25", "4"])
    for (const record of records) {
      const fontId = record.getNumber("FONTID")
      expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe(points)
      expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
    }
  }
  // A sheet note with the same source size keeps its existing font mapping.
  const note = schematic.records.find(
    (record) => record.getDecoded("TEXT") === "NOTE",
  )!
  expect(sheet.getCaseInsensitive(`SIZE${note.getNumber("FONTID")}`)).toBe(
    "4.4000",
  )
  expectValidSchematic(schematic)
})
