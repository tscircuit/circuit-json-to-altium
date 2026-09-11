import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("exports the smallest native junctions without changing wiring or text", async () => {
  const source = await Bun.file(
    new URL(
      "./assets/generated-system-light-motor-control.circuit.json",
      import.meta.url,
    ),
  ).json()
  const previous = parseAltiumSchDoc(
    await Bun.file(
      new URL(
        "./assets/light-motor-control-power-supply-annotation-text-5pt.SchDoc",
        import.meta.url,
      ),
    ).bytes(),
  )
  const converter = new CircuitJsonToAltiumConverter(source, {
    projectName: "light-motor-control-system",
  })
  converter.runUntilFinished()
  const output = converter
    .getOutput()
    .schematics.find(
      ({ filename }) => filename === "light-motor-control-system-06.SchDoc",
    )!
  const schematic = parseAltiumSchDoc(output.content)
  const junctions = schematic.getRecordsByKind("29")
  expect(junctions).toHaveLength(22)
  for (const junction of junctions) {
    expect(junction.getCaseInsensitive("SIZE")).toBe("0")
  }
  // Keep the native electrical junctions, their positions and every other
  // record intact; only the junction size preset changes.
  const fields = (document: typeof schematic) =>
    document.records.map((record) =>
      record.fields
        .filter(({ key }) => record.recordKind !== "29" || key !== "SIZE")
        .map(({ key, value }) => [key, value]),
    )
  expect(fields(schematic)).toEqual(fields(previous))
  expectValidSchematic(schematic)
})
