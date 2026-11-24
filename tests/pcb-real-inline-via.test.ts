import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const sourceVia = elements.find(
    (element) => element.pcb_via_id === "pcb_via_15",
  )!
  const viaIndex = elements
    .filter((element) => element.type === "pcb_via")
    .indexOf(sourceVia)
  const baseline = await extractArchive(elements)
  // The ADC_VREF route already contains this same via, including its sizes.
  // Removing the duplicate standalone record keeps the physical board intact.
  const actual = await extractArchive(
    elements.filter((element) => element !== sourceVia),
  )
  const baselineVia = baseline.pcb.vias[viaIndex]!
  const center = {
    x: baselineVia.getAltiumMeasurement("X")!.toMils(),
    y: baselineVia.getAltiumMeasurement("Y")!.toMils(),
  }
  const inlineVia = actual.pcb.vias.find(
    (via) =>
      via.getAltiumMeasurement("X")?.toMils() === center.x &&
      via.getAltiumMeasurement("Y")?.toMils() === center.y,
  )
  return { baseline, actual, center, inlineVia }
}

test.failing("preserves the real ADC_VREF via when represented by its inline route", async () => {
  const { baseline, actual, inlineVia } = await scenario()
  expect(actual.pcb.vias).toHaveLength(baseline.pcb.vias.length)
  expect(inlineVia).toBeDefined()
  expect(
    inlineVia?.getAltiumMeasurement("DIAMETER")?.toMillimeters(),
  ).toBeCloseTo(0.5, 4)
  expect(
    inlineVia?.getAltiumMeasurement("HOLESIZE")?.toMillimeters(),
  ).toBeCloseTo(0.3, 4)
  expect(actual.pcb.getNetForRecord(inlineVia!)?.name).toBe("ADC_VREF")
}, 30_000)

test("snapshots the real ADC_VREF inline via and nearby copper", async () => {
  const { actual, center } = await scenario()
  await expect(
    serializeAltiumPcbToSvg(actual.pcb, {
      width: 600,
      height: 480,
      layers: ["TOP", "BOTTOM"],
      showBoardOutline: false,
      viewBox: {
        x: center.x - 50,
        y: center.y - 40,
        width: 100,
        height: 80,
      },
    }),
  ).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
