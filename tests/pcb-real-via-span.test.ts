import { expect, test } from "bun:test"
import { AltiumViaRecord } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const via = elements.find((element) => element.type === "pcb_via")!
  // Manufacturing variant: keep the real via's position, sizes and net.
  via.layers = ["top", "inner1"]
  return extractArchive(elements)
}

test("preserves a real-board via changed to a blind span", async () => {
  const { pcb } = await scenario()
  const via = pcb.vias[0]
  expect(via instanceof AltiumViaRecord && via.endLayer).toBe("MID-LAYER1")
}, 30_000)

test("records the real via's native endpoints and net", async () => {
  const { pcb } = await scenario()
  const via = pcb.vias[0] as AltiumViaRecord
  expect({
    startLayer: via.startLayer,
    endLayer: via.endLayer,
    net: pcb.getNetForRecord(via)?.name ?? null,
  }).toMatchInlineSnapshot(`
    {
      "endLayer": "MID-LAYER1",
      "net": "DRIVER_STEP",
      "startLayer": "TOP",
    }
  `)
}, 30_000)
