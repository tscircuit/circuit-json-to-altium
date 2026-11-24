import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const pads = elements.filter((element) => element.type === "pcb_smtpad")
  const pad = pads.find((element) => element.shape === "rect")!
  pad.is_covered_with_solder_mask = true
  pad.soldermask_margin = 0.3
  const result = await extractArchive(elements)
  return {
    ...result,
    pad: result.pcb.getRecordsByKind("Pad")[pads.indexOf(pad)]!,
  }
}

test.failing("retains mask coverage on the first real rectangular SMT pad", async () => {
  const { pad } = await scenario()
  expect(pad.getBoolean("TENTEDTOP")).toBe(true)
}, 30_000)

test("snapshots copper and mask separately around the covered real pad", async () => {
  const { pcb, pad } = await scenario()
  const x = pad.getAltiumMeasurement("X")!.toMils()
  const y = pad.getAltiumMeasurement("Y")!.toMils()
  const options = {
    width: 480,
    height: 360,
    showBoardOutline: false,
    componentIndices: [pad.getNumber("COMPONENT")!],
    viewBox: { x: x - 80, y: y - 60, width: 160, height: 120 },
  }
  await expect(
    serializeAltiumPcbToSvg(pcb, { ...options, layers: ["TOP"] }),
  ).toMatchSvgSnapshot(import.meta.path, "copper")
  await expect(
    serializeAltiumPcbToSvg(pcb, { ...options, layers: ["TOPSOLDER"] }),
  ).toMatchSvgSnapshot(import.meta.path, "mask")
}, 30_000)
