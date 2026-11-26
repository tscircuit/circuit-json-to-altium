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

test.failing("retains mask coverage on the first NEMA17 rectangular SMT pad", async () => {
  const { pad } = await scenario()
  expect(pad.getBoolean("TENTEDTOP")).toBe(true)
}, 30_000)

test("snapshots the complete NEMA17 board and top solder mask", async () => {
  const { pcb } = await scenario()
  const options = {
    width: 1000,
    height: 1000,
    showBoardOutline: true,
  }
  await expect(serializeAltiumPcbToSvg(pcb, options)).toMatchSvgSnapshot(
    import.meta.path,
    "board",
  )
  await expect(
    serializeAltiumPcbToSvg(pcb, { ...options, layers: ["TOPSOLDER"] }),
  ).toMatchSvgSnapshot(import.meta.path, "mask")
}, 30_000)
