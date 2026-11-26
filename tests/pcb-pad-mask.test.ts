import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"

async function exportSimpleFocMini() {
  const elements = (await Bun.file(
    new URL("./assets/simplefoc-mini-silkscreen.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const result = await extractArchive(elements)
  return {
    ...result,
    smtPads: elements.filter((element) => element.type === "pcb_smtpad"),
  }
}

test.failing("preserves the original SimpleFOC Mini SMT solder-mask margins", async () => {
  const { pcb, smtPads } = await exportSimpleFocMini()
  expect(smtPads).toHaveLength(49)
  const pads = pcb.getRecordsByKind("Pad")
  for (const [index, smtPad] of smtPads.entries()) {
    expect(smtPad.soldermask_margin).toBe(0.0508)
    expect(pads[index]!.get("SOLDERMASKEXPANSIONMODE")).toBe("Manual")
    expect(
      pads[index]!.getAltiumMeasurement(
        "SOLDERMASKEXPANSION_MANUAL",
      )?.toMillimeters(),
    ).toBeCloseTo(0.0508, 4)
  }
}, 30_000)

test("snapshots the complete SimpleFOC Mini board and top solder mask", async () => {
  const { pcb } = await exportSimpleFocMini()
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
