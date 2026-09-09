import { expect, test } from "bun:test"
import { board, expectValidSchematic, extractArchive } from "./fixtures"

test("preserves custom inline sizes and uses integer fonts for matched net labels", async () => {
  const samples = [
    { text: "SIGNAL", size: 0.12, points: "3" },
    { text: "CUSTOM", size: 0.2, points: "4" },
    { text: "LARGE", size: 0.5, points: "10" },
    { text: "SMALL", size: 0.01, points: "1" },
  ]
  const { schematics } = await extractArchive([
    board(),
    ...samples.map(({ text, size }, index) => ({
      type: "schematic_text",
      schematic_text_id: `text_${index}`,
      source_trace_id: `trace_${index}`,
      text,
      font_size: size,
      position: { x: index * 2, y: 0 },
      anchor: "bottom_left",
      rotation: 0,
      color: "#123456",
    })),
    {
      type: "schematic_net_label",
      schematic_net_label_id: "signal_label",
      source_net_id: "signal_net",
      text: "SIGNAL",
      center: { x: 0, y: 0 },
      anchor_position: { x: 0, y: 0 },
      anchor_side: "left",
    },
  ])
  const schematic = schematics[0]!
  const sheet = schematic.getRecordsByKind("31")[0]!

  for (const { text, points } of samples) {
    const records = schematic.records.filter(
      (record) => record.getDecoded("TEXT") === text,
    )
    expect(records).toHaveLength(1)
    const record = records[0]!
    expect(record.recordKind).toBe(text === "SIGNAL" ? "25" : "4")
    const fontId = record.getNumber("FONTID")
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe(points)
    expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
    expect(record.getNumber("COLOR")).toBe(0x56_34_12)
  }
  expectValidSchematic(schematic)
})
