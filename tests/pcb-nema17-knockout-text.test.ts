import { expect, test } from "bun:test"
import { AltiumTextRecord, serializeAltiumPcbToSvg } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"
import { renderAltiumKnockoutLabels } from "./fixtures/render-altium-knockout-labels"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const { pcb } = await extractArchive(elements, "nema17")
  const texts = pcb.texts.filter(
    (text): text is AltiumTextRecord => text instanceof AltiumTextRecord,
  )
  return {
    pcb,
    texts,
    labels: texts.filter(
      (label) => label.text === "DATA" || label.text === "PWR",
    ),
  }
}

test("preserves nema17 DATA and PWR knockout text and its border margin", async () => {
  const { texts } = await scenario()
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
}, 30_000)

test("snapshots real native knockout-label styles and the complete board", async () => {
  const { pcb, labels } = await scenario()
  expect(labels).toHaveLength(3)
  expect(
    labels.map((label) => ({
      text: label.text,
      inverted: label.inverted,
      marginMm: Number(
        (
          label.getAltiumMeasurement("MARGINBORDERWIDTH")?.toMillimeters() ?? 0
        ).toFixed(4),
      ),
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "inverted": false,
        "marginMm": 0,
        "text": "PWR",
      },
      {
        "inverted": true,
        "marginMm": 0.18,
        "text": "DATA",
      },
      {
        "inverted": true,
        "marginMm": 0.18,
        "text": "PWR",
      },
    ]
  `)
  await expect(renderAltiumKnockoutLabels(labels)).toMatchSvgSnapshot(
    import.meta.path,
    "labels",
  )
  await expect(
    serializeAltiumPcbToSvg(pcb, { width: 1000, height: 1000 }),
  ).toMatchSvgSnapshot(import.meta.path, "full-board")
}, 30_000)
