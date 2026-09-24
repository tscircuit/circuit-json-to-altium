import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"
import {
  getRecordCorner,
  getRecordLocation,
} from "./fixtures/altium-schematic-coordinate-utils"
import { getHairlinePinStem } from "./fixtures/get-hairline-pin-stem"

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
  // Compare the hairline change using the 3 pt number font and 3-unit margin.
  // The historical fixture has 3 pt names, but predates the number-text fixes.
  // Normalize its old name-margin encoding to the native 2-unit inset too.
  // Font and position behavior are covered separately in schematic29/30/39.
  const beforeSheet = before.getRecordsByKind("31")[0]!
  for (const pin of before.pins) {
    const fontId = pin.getCaseInsensitive("NAME_CUSTOMFONTID")!
    expect(beforeSheet.getCaseInsensitive(`SIZE${fontId}`)).toBe("3")
    pin.set("DESIGNATOR_CUSTOMFONTID", fontId)
    pin.set("PINDESIGNATOR_POSITIONCONGLOMERATE", "17")
    pin.set("DESIGNATOR_CUSTOMPOSITION_MARGIN", "3")
    pin.set("NAME_CUSTOMPOSITION_MARGIN", "0")
  }
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
    expect(pin.getNumber("PINLENGTH")).toBe(0)
    // The native terminal meets the original pin endpoint directly.
    const previousEnd = endpoint(previous)
    expect(pin.position).toEqual({ x: previousEnd[0]!, y: previousEnd[1]! })
    const stem = getHairlinePinStem(after, pin)!
    expect(stem).toBeDefined()
    expect(getRecordCorner(stem)).toEqual(pin.position!)
    expect(getRecordLocation(stem)).not.toEqual(pin.position!)
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
  expect(after.wires.length).toBe(before.wires.length)
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
