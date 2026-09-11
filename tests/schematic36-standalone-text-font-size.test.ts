import { expect, test } from "bun:test"
import { board, expectValidSchematic, extractArchive } from "./fixtures"

test("exports standalone notes with native integer fonts and their source presentation", async () => {
  const samples = [
    {
      text: "Open = Diable LM5050-Q1",
      size: 0.22,
      points: "5",
      anchor: "center_right",
      justification: 5,
      rotation: 0,
    },
    {
      text: "Close = Enable LM5050-Q1",
      size: 0.22,
      points: "5",
      anchor: "center_right",
      justification: 5,
      rotation: 0,
    },
    {
      text: "60V",
      size: 0.22,
      points: "5",
      anchor: "center_left",
      justification: 3,
      rotation: 0,
    },
    {
      text: "INTEGER",
      size: 0.2,
      points: "4",
      anchor: "bottom_left",
      justification: 0,
      rotation: 90,
    },
    {
      text: "SMALL",
      size: 0.01,
      points: "1",
      anchor: "top_left",
      justification: 6,
      rotation: 0,
    },
    {
      text: "LARGE",
      size: 0.6,
      points: "12",
      anchor: "center",
      justification: 4,
      rotation: 0,
    },
  ]
  const { schematics } = await extractArchive([
    board(),
    ...samples.map(({ text, size, anchor, rotation }, index) => ({
      type: "schematic_text",
      schematic_text_id: `note_${index}`,
      text,
      font_size: size,
      position: { x: index * 4, y: 0 },
      anchor,
      rotation,
      color: "#123456",
    })),
  ])
  const schematic = schematics[0]!
  const sheet = schematic.getRecordsByKind("31")[0]!

  for (const { text, points, justification, rotation } of samples) {
    const records = schematic.records.filter(
      (record) => record.getDecoded("TEXT") === text,
    )
    expect(records).toHaveLength(1)
    const record = records[0]!
    expect(record.recordKind).toBe("4")
    expect(schematic.getParent(record)).toBeUndefined()
    const fontId = record.getNumber("FONTID")
    // Check the serialized value: fractional SIZE fields select Altium's
    // fallback font instead of the source text size.
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe(points)
    expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
    expect(record.getNumber("COLOR")).toBe(0x56_34_12)
    expect(record.getNumber("JUSTIFICATION")).toBe(justification)
    expect(record.getNumber("ORIENTATION")).toBe(rotation === 90 ? 1 : 0)
  }
  expectValidSchematic(schematic)
})
