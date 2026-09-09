import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

test("exports the microcontroller reference and MPN at the capacitor text size", async () => {
  const circuitJson = await Bun.file(
    new URL(
      "./assets/generated-system-automotive-mirror.circuit.json",
      import.meta.url,
    ),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "automotive-mirror-system",
  })
  converter.runUntilFinished()
  const file = converter
    .getOutput()
    .schematics.find(
      (sheet) => sheet.filename === "automotive-mirror-system-04.SchDoc",
    )
  if (!file) throw new Error("Expected the microcontroller schematic")
  const doc = parseAltiumSchDoc(file.content)
  const sheet = doc.getRecordsByKind("31")[0]!

  // Check the actual native font tokens used by Altium, including the MPN
  // stored as component graphic text rather than a Comment parameter.
  for (const text of ["U1", "MSPM0G3507SPMR", "C1", "C2", "0.1uF"]) {
    const record = doc.records.find(
      (record) => record.getDecoded("TEXT") === text,
    )
    expect(record, `Expected ${text}`).toBeDefined()
    const fontId = record!.getNumber("FONTID")
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe("4")
    expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
  }
})
