import { expect, test } from "bun:test"
import { getSchematicRecordPoints, parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("exports compact single-text labels connected to the original wire anchors", async () => {
  const circuitJson = await Bun.file(
    new URL(
      "./assets/generated-system-automotive-mirror.circuit.json",
      import.meta.url,
    ),
  ).json()
  const before = parseAltiumSchDoc(
    await Bun.file(
      new URL(
        "./assets/automotive-mirror-microcontroller-net-label-text-4pt.SchDoc",
        import.meta.url,
      ),
    ).bytes(),
  )
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "automotive-mirror-system",
  })
  converter.runUntilFinished()
  const file = converter
    .getOutput()
    .schematics.find(
      (sheet) => sheet.filename === "automotive-mirror-system-04.SchDoc",
    )!
  const doc = parseAltiumSchDoc(file.content)
  expect(doc.netLabels.map((label) => label.text)).toEqual(
    before.netLabels.map((label) => label.text),
  )
  expect(doc.netLabels).toHaveLength(16)
  expect(
    doc
      .getRecordsByKind("4")
      .some((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNT")),
  ).toBe(false)
  for (const [index, label] of doc.netLabels.entries()) {
    expect(label.getBoolean("ISHIDDEN")).not.toBe(true)
    const id = label.getDecoded("UNIQUEID")!
    const outline = doc.records.find(
      (record) => record.getDecoded("UNIQUEID") === id.replace("CJNT", "CJNP"),
    )!
    const wire = doc.records.find(
      (record) => record.getDecoded("UNIQUEID") === id.replace("CJNT", "CJNW"),
    )!
    // Check actual integer tokens; decimal base fields collapse to zero in Altium.
    for (const record of [label, outline, wire]) {
      for (const { key, value } of record.fields) {
        if (/^(?:LOCATION\.[XY]|[XY]\d+)(?:_FRAC)?$/u.test(key)) {
          expect(value).toMatch(/^-?\d+$/u)
        }
      }
    }
    const points = getSchematicRecordPoints(outline)
    expect(points).toHaveLength(5)
    expect(points[0]).toEqual(before.netLabels[index]!.position!)
    expect(getSchematicRecordPoints(wire)).toEqual([
      points[0]!,
      label.position!,
    ])
    const width =
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
    const height =
      Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))
    expect(height).toBeCloseTo(4)
    expect(width).toBeLessThan(30)
    expect(width).toBeGreaterThan(5)
  }
  expectValidSchematic(doc)
})
