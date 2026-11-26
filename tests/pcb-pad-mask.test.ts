import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { convertAltiumPcbToCircuitJson } from "./fixtures/convert-altium-pcb-to-circuit-json"

async function exportSimpleFocMini() {
  const source = parseAltiumPcbDoc(
    await Bun.file(
      new URL("../references/simplefoc-mini.PcbDoc", import.meta.url),
    ).text(),
  )
  const elements = convertAltiumPcbToCircuitJson(source)
  const converter = new CircuitJsonToAltiumConverter(elements)
  converter.runUntilFinished()
  return {
    pcb: parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content),
    smtPads: elements.filter((element) => element.type === "pcb_smtpad"),
  }
}

test("preserves the original SimpleFOC Mini SMT solder-mask margins", async () => {
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
