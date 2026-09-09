import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

test("exports ordinary microcontroller net-label text at a native integer size", async () => {
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
  expect(doc.netLabels).toHaveLength(16)
  for (const record of doc.netLabels) {
    const fontId = record.getNumber("FONTID")
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe("4")
    expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
  }
})
