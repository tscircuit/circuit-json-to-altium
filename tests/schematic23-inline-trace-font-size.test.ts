import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

test("exports the microcontroller inline trace labels at a native integer size", async () => {
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
  const inlineLabels = doc
    .getRecordsByKind("4")
    .filter((record) =>
      ["SWDIO", "SWCLK", "NRST", "PA0"].includes(
        record.getDecoded("TEXT") ?? "",
      ),
    )

  expect(inlineLabels.map((record) => record.getDecoded("TEXT"))).toEqual([
    "SWDIO",
    "SWDIO",
    "SWCLK",
    "SWCLK",
    "NRST",
    "NRST",
    "PA0",
  ])
  for (const record of inlineLabels) {
    const fontId = record.getNumber("FONTID")
    expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe("3")
    expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
  }
  expect(inlineLabels.map((record) => record.getNumber("ORIENTATION"))).toEqual(
    [0, 0, 0, 0, 1, 0, 1],
  )
  expect(
    inlineLabels.every((record) => record.getNumber("COLOR") === 132),
  ).toBe(true)
})
