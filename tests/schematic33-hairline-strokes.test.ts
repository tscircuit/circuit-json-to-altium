import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("exports smallest schematic strokes with unchanged text fonts", async () => {
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
  const graphicKinds = new Set(["6", "7", "13", "14", "27"])
  for (const record of doc.records) {
    if (graphicKinds.has(record.recordKind!)) {
      expect(record.getNumber("LINEWIDTH")).toBe(0)
    }
    if (record.recordKind === "2") {
      expect(record.getNumber("SYMBOL_LINEWIDTH")).toBe(0)
    }
  }
  for (const kind of ["4", "25", "31", "34", "41"]) {
    const fields = (document: typeof doc) =>
      document
        .getRecordsByKind(kind)
        .map((record) =>
          record.fields
            .filter(({ key }) => key !== "OWNERINDEX")
            .map(({ key, value }) => [key, value]),
        )
    expect(fields(doc)).toEqual(fields(previous))
  }
  expect(doc.getRecordsByKind("6")).toHaveLength(28)
  expect(doc.getRecordsByKind("7")).toHaveLength(16)
  expect(doc.getRecordsByKind("14")).toHaveLength(2)
  expect(doc.getRecordsByKind("27")).toHaveLength(54 + doc.pins.length)

  // A renderer downgrade can still accept LINEWIDTH=0 while painting thick
  // strokes. Verify that the exported shapes retain device hairlines in SVG.
  const svg = serializeAltiumSheetToSvg(doc)
  const graphicTags = Array.from(
    svg.matchAll(/<[^>]+data-record="(6|7|13|14|27)"[^>]*>/gu),
    ([tag]) => tag,
  )
  expect(graphicTags.length).toBeGreaterThan(0)
  for (const tag of graphicTags) {
    expect(tag).toContain('vector-effect="non-scaling-stroke"')
    expect(tag).toContain('stroke-width="1"')
  }
})
