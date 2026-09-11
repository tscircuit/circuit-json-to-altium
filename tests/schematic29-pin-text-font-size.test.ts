import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

test("exports native Arial 3 pin names and Arial 4 numbers with the correct name inset", async () => {
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
    const detachedStem =
      record.getNumber("PINLENGTH") === 0 &&
      previous.getNumber("PINLENGTH")! > 0
    const stemLength = detachedStem ? previous.getNumber("PINLENGTH")! : 0
    expect(record.getNumber("FONTID")).toBeUndefined()
    // Offsets keep text at the same position when the electrical pin is zero length.
    expect(record.getNumber("PINNAME_POSITIONCONGLOMERATE")).toBe(17)
    expect(record.getNumber("NAME_CUSTOMPOSITION_MARGIN")).toBe(-2 - stemLength)
    expect(record.getNumber("NAME_CUSTOMPOSITION_MARGIN_FRAC")).toBeUndefined()
    expect(record.getNumber("PINDESIGNATOR_POSITIONCONGLOMERATE")).toBe(
      detachedStem ? 17 : 16,
    )
    expect(record.getNumber("DESIGNATOR_CUSTOMPOSITION_MARGIN")).toBe(
      detachedStem ? 9 - stemLength : undefined,
    )
    for (const kind of ["NAME", "DESIGNATOR"]) {
      const fontId = record.getNumber(`${kind}_CUSTOMFONTID`)
      expect(sheet.getCaseInsensitive(`SIZE${fontId}`)).toBe(
        kind === "NAME" ? "3" : "4",
      )
      expect(sheet.getDecoded(`FONTNAME${fontId}`)).toBe("Arial")
      expect(record.getNumber(`${kind}_CUSTOMCOLOR`)).toBe(
        previous.getNumber("COLOR"),
      )
    }
    // Capacitors and resistors now explicitly encode Passive instead of the old implicit Input.
    if (record.getNumber("ELECTRICAL") !== undefined) {
      expect(record.getNumber("ELECTRICAL")).toBe(4)
      const owner = doc.records[record.getNumber("OWNERINDEX")!]!
      expect(owner.get("LIBREFERENCE")).toMatch(
        /^(capacitor|(?:box)?resistor)/u,
      )
    }
    for (const field of [
      "NAME",
      "DESIGNATOR",
      "PINCONGLOMERATE",
      "SYMBOL_INNEREDGE",
      "SYMBOL_OUTEREDGE",
    ]) {
      expect(record.getCaseInsensitive(field)).toBe(
        previous.getCaseInsensitive(field),
      )
    }
  }
})
