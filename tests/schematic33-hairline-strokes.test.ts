import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("exports smallest schematic strokes without changing text or geometry", async () => {
  const source = await Bun.file(
    new URL(
      "./assets/generated-system-automotive-mirror.circuit.json",
      import.meta.url,
    ),
  ).json()
  const previous = parseAltiumSchDoc(
    await Bun.file(
      new URL(
        "./assets/automotive-mirror-microcontroller-pin-names-3pt-numbers-4pt.SchDoc",
        import.meta.url,
      ),
    ).bytes(),
  )
  const converter = new CircuitJsonToAltiumConverter(source, {
    projectName: "automotive-mirror-system",
  })
  converter.runUntilFinished()
  const file = converter
    .getOutput()
    .schematics.find(
      (sheet) => sheet.filename === "automotive-mirror-system-04.SchDoc",
    )!
  const doc = parseAltiumSchDoc(file.content)
  expectValidSchematic(doc)
  expect(doc.records).toHaveLength(previous.records.length)
  const graphicKinds = new Set(["6", "7", "14", "27"])
  for (const [index, record] of doc.records.entries()) {
    if (graphicKinds.has(record.recordKind!)) {
      expect(record.getNumber("LINEWIDTH")).toBe(0)
    }
    if (record.recordKind === "2") {
      expect(record.getNumber("SYMBOL_LINEWIDTH")).toBe(0)
    }
    // The reference predates the separate capacitor/resistor Passive fixes.
    // Every text/font/position field and all wire/pin geometry must be identical.
    const unchangedFields = (fields: typeof record.fields) =>
      fields
        .filter(
          ({ key }) =>
            !["LINEWIDTH", "SYMBOL_LINEWIDTH", "ELECTRICAL"].includes(key),
        )
        .map(({ key, value }) => [key, value])
    expect(unchangedFields(record.fields)).toEqual(
      unchangedFields(previous.records[index]!.fields),
    )
  }
  expect(doc.getRecordsByKind("6")).toHaveLength(28)
  expect(doc.getRecordsByKind("7")).toHaveLength(16)
  expect(doc.getRecordsByKind("14")).toHaveLength(2)
  expect(doc.getRecordsByKind("27")).toHaveLength(54)
})
