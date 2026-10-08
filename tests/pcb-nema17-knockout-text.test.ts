import { expect, test } from "bun:test"
import { AltiumTextRecord, parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import type { CircuitElement } from "./fixtures"

test("preserves nema17 DATA and PWR knockout text and its border margin", async () => {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const converter = new CircuitJsonToAltiumConverter(elements, {
    projectName: "nema17",
  })
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const texts = document.records.filter(
    (record): record is AltiumTextRecord => record instanceof AltiumTextRecord,
  )
  const knockout = texts.filter((text) => text.inverted === true)
  expect(knockout.map((text) => text.text).sort()).toEqual(["DATA", "PWR"])
  for (const text of knockout) {
    expect(text.layer).toBe("TOPOVERLAY")
    expect(text.getBoolean("INVERTEDRECT")).toBe(false)
    expect(
      text.getAltiumMeasurement("MARGINBORDERWIDTH")?.toMillimeters(),
    ).toBeCloseTo(0.18, 4)
    expect(text.mirrored).toBe(false)
  }
  expect(
    texts.filter((text) => text.text === "PWR" && !text.inverted).length,
  ).toBeGreaterThan(0)
})
