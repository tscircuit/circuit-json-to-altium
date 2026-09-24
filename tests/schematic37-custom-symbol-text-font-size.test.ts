import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("exports U3 custom-symbol text with native integer fonts", async () => {
  const circuitJson = await Bun.file(
    new URL(
      "./assets/generated-system-blood-pressure-monitor.circuit.json",
      import.meta.url,
    ),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "blood-pressure-monitor",
  })
  converter.runUntilFinished()
  const output = converter
    .getOutput()
    .schematics.find(
      ({ filename }) => filename === "blood-pressure-monitor-01.SchDoc",
    )!
  const schematic = parseAltiumSchDoc(output.content)
  const sheet = schematic.getRecordsByKind("31")[0]!
  const component = schematic.components.find(
    (record) => record.getDecoded("UNIQUEID") === "schematic_component_3",
  )!
  const texts = schematic
    .getOwnedRecords(component)
    .filter((record) => record.recordKind === "4")
  expect(texts.map((record) => record.getDecoded("TEXT"))).toEqual([
    "1",
    "2",
    "3",
    "U3",
    "ATL431LIBIDBZR",
  ])
  for (const text of texts) {
    const fontId = text.getNumber("FONTID")
    expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe(
      text.getDecoded("TEXT") === "U3" ? "4" : "3",
    )
    expect(text.getNumber("COLOR")).toBe(0)
    expect(text.getNumber("JUSTIFICATION")).toBe(
      text.getDecoded("TEXT") === "ATL431LIBIDBZR" ? 3 : 4,
    )
  }
  expectValidSchematic(schematic)
})
