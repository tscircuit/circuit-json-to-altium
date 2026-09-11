import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("uses hairline passive stems without moving electrical endpoints or text", async () => {
  const source = await Bun.file(
    new URL(
      "./assets/generated-system-automotive-mirror.circuit.json",
      import.meta.url,
    ),
  ).json()
  const before = parseAltiumSchDoc(
    await Bun.file(
      new URL(
        "./assets/automotive-mirror-microcontroller-hairline-strokes.SchDoc",
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
      (s) => s.filename === "automotive-mirror-system-04.SchDoc",
    )!
  const after = parseAltiumSchDoc(file.content)
  expectValidSchematic(after)
  expect(after.pins.length).toBe(before.pins.length)
  let passiveCount = 0
  const endpoint = (pin: (typeof before.pins)[number]) => {
    const rotation = pin.getNumber("PINCONGLOMERATE")! & 3
    const length = pin.getNumber("PINLENGTH")!
    return [
      pin.getNumber("LOCATION.X")! + [1, 0, -1, 0][rotation]! * length,
      pin.getNumber("LOCATION.Y")! + [0, 1, 0, -1][rotation]! * length,
    ]
  }
  for (const [index, pin] of after.pins.entries()) {
    const previous = before.pins[index]!
    expect(endpoint(pin)).toEqual(endpoint(previous))
    for (const field of [
      "NAME",
      "DESIGNATOR",
      "ELECTRICAL",
      "COLOR",
      "NAME_CUSTOMFONTID",
      "DESIGNATOR_CUSTOMFONTID",
      "NAME_CUSTOMCOLOR",
      "DESIGNATOR_CUSTOMCOLOR",
    ]) {
      expect(pin.getCaseInsensitive(field)).toBe(
        previous.getCaseInsensitive(field),
      )
    }
    if (pin.getNumber("ELECTRICAL") === 4) {
      passiveCount++
      expect(pin.getNumber("PINLENGTH")).toBe(0)
      const line = after
        .getRecordsByKind("13")
        .find(
          (r) =>
            r.getNumber("OWNERINDEX") === pin.getNumber("OWNERINDEX") &&
            r.getNumber("CORNER.X") === endpoint(pin)[0] &&
            r.getNumber("CORNER.Y") === endpoint(pin)[1],
        )!
      expect(line).toBeDefined()
      expect(line.getNumber("LINEWIDTH")).toBe(0)
      expect([
        line.getNumber("LOCATION.X"),
        line.getNumber("LOCATION.Y"),
      ]).toEqual([
        previous.getNumber("LOCATION.X"),
        previous.getNumber("LOCATION.Y"),
      ])
    } else {
      expect(pin.getNumber("PINLENGTH")).toBe(previous.getNumber("PINLENGTH"))
    }
  }
  expect(passiveCount).toBe(16)
  const text = (doc: typeof before) =>
    Array.from(
      serializeAltiumSheetToSvg(doc).matchAll(/<text\b[\s\S]*?<\/text>/gu),
      (m) => m[0].replace(/ data-record-index="\d+"/gu, ""),
    )
  expect(text(after)).toEqual(text(before))
})
