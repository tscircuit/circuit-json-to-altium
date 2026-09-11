import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"

test("uses hairline stems for every component type with unchanged text and connected terminals", async () => {
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
    expect([pin.getNumber("LOCATION.X"), pin.getNumber("LOCATION.Y")]).toEqual([
      previous.getNumber("LOCATION.X"),
      previous.getNumber("LOCATION.Y"),
    ])
    expect(pin.getNumber("PINLENGTH")).toBe(0)
    const stem = after.wires.find(
      (wire) =>
        wire.getNumber("X1") === endpoint(pin)[0] &&
        wire.getNumber("Y1") === endpoint(pin)[1] &&
        wire.getNumber("X2") === endpoint(previous)[0] &&
        wire.getNumber("Y2") === endpoint(previous)[1],
    )!
    expect(stem).toBeDefined()
    expect(stem.getNumber("LINEWIDTH")).toBe(0)
    expect(stem.getNumber("COLOR")).toBe(pin.getNumber("COLOR"))
    for (const field of [
      "NAME",
      "DESIGNATOR",
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
  }
  expect(after.wires.length).toBe(before.wires.length + before.pins.length)
  expect(after.powerPorts.map((port) => port.text)).toEqual(
    before.powerPorts.map((port) => port.text),
  )
  for (const port of after.powerPorts) {
    const graphics = after.getObjectDefinitionGraphics(
      port.getCaseInsensitive("ObjectDefinitionId")!,
    )!
    expect(graphics).toHaveLength(2)
    expect(graphics.every((line) => line.getNumber("LINEWIDTH") === 0)).toBe(
      true,
    )
  }
  const text = (doc: typeof before) =>
    Array.from(
      serializeAltiumSheetToSvg(doc).matchAll(/<text\b[\s\S]*?<\/text>/gu),
      (m) => m[0].replace(/ data-record-index="\d+"/gu, ""),
    )
  expect(text(after)).toEqual(text(before))
})
