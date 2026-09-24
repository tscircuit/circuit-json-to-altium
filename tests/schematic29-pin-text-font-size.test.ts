import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

test("exports native Arial 3 pin names and numbers with the correct margins", async () => {
  const circuitJson = await Bun.file(
    new URL(
      "./assets/generated-system-automotive-mirror.circuit.json",
      import.meta.url,
    ),
  ).json()
  const before = parseAltiumSchDoc(
    await Bun.file(
      new URL(
        "./assets/automotive-mirror-microcontroller-pointed-net-labels.SchDoc",
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
  const sheet = doc.getRecordsByKind("31")[0]!
  expect(doc.pins).toHaveLength(before.pins.length)
  expect(doc.getRecordsByKind("2").length).toBeGreaterThan(0)
  for (const [index, record] of doc.pins.entries()) {
    const previous = before.pins[index]!
    expect(record.getNumber("FONTID")).toBeUndefined()
    // Text remains anchored to the original body with independent native fonts.
    expect(record.getNumber("PINNAME_POSITIONCONGLOMERATE")).toBe(17)
    const orientation = record.getNumber("PINCONGLOMERATE")! & 3
    const dx = [1, 0, -1, 0][orientation]!
    const dy = [0, 1, 0, -1][orientation]!
    const markerOffset =
      (record.position!.x - previous.position!.x) * dx +
      (record.position!.y - previous.position!.y) * dy
    const margin = (key: string) =>
      record.getNumber(key)! + (record.getNumber(`${key}_FRAC`) ?? 0) / 100_000
    expect(margin("NAME_CUSTOMPOSITION_MARGIN") - markerOffset).toBeCloseTo(
      0,
      4,
    )
    expect(record.getNumber("PINDESIGNATOR_POSITIONCONGLOMERATE")).toBe(17)
    expect(
      margin("DESIGNATOR_CUSTOMPOSITION_MARGIN") + markerOffset,
    ).toBeCloseTo(3, 4)
    for (const kind of ["NAME", "DESIGNATOR"]) {
      const fontId = record.getNumber(`${kind}_CUSTOMFONTID`)
      expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe("3")
      expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
      expect(record.getNumber(`${kind}_CUSTOMCOLOR`)).toBe(
        previous.getNumber("COLOR"),
      )
    }
    // The historic file mapped input arrows to an extra IEEE clock symbol.
    expect(record.getNumber("SYMBOL_INNEREDGE")).toBeUndefined()
    for (const field of [
      "NAME",
      "DESIGNATOR",
      "PINCONGLOMERATE",
      "SYMBOL_OUTEREDGE",
    ]) {
      expect(record.getCaseInsensitive(field)).toBe(
        previous.getCaseInsensitive(field),
      )
    }
  }
})
