import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

test("exports native Arial 4 pin text with inset names and unchanged number placement", async () => {
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
  expect(doc.records).toHaveLength(before.records.length)
  expect(doc.getRecordsByKind("2").length).toBeGreaterThan(0)
  for (const [index, record] of doc.records.entries()) {
    const previous = before.records[index]!
    if (record.recordKind !== "2") {
      expect(record.fields.map(({ key, value }) => [key, value])).toEqual(
        previous.fields.map(({ key, value }) => [key, value]),
      )
      continue
    }
    expect(record.getNumber("FONTID")).toBeUndefined()
    // Only names opt into custom position: 0.1 circuit units inside the body.
    expect(record.getNumber("PINNAME_POSITIONCONGLOMERATE")).toBe(17)
    expect(record.getNumber("NAME_CUSTOMPOSITION_MARGIN")).toBe(-2)
    expect(record.getNumber("NAME_CUSTOMPOSITION_MARGIN_FRAC")).toBeUndefined()
    expect(record.getNumber("PINDESIGNATOR_POSITIONCONGLOMERATE")).toBe(16)
    expect(record.getNumber("DESIGNATOR_CUSTOMPOSITION_MARGIN")).toBeUndefined()
    for (const kind of ["NAME", "DESIGNATOR"]) {
      const fontId = record.getNumber(`${kind}_CUSTOMFONTID`)
      expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe("4")
      expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
      expect(record.getNumber(`${kind}_CUSTOMCOLOR`)).toBe(
        previous.getNumber("COLOR"),
      )
    }
    // Geometry, labels, visibility and electrical symbols retain their native fields.
    expect(
      record.fields
        .filter(({ key }) => !/CUSTOM|POSITIONCONGLOMERATE/u.test(key))
        .map(({ key, value }) => [key, value]),
    ).toEqual(
      previous.fields
        .filter(({ key }) => key !== "FONTID")
        .map(({ key, value }) => [key, value]),
    )
  }
})
