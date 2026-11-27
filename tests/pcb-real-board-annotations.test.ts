import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { type CircuitElement, expectValidPcb, extractArchive } from "./fixtures"

async function loadBoard(): Promise<CircuitElement[]> {
  return Bun.file(
    new URL(
      "./assets/ti-pmp22712-board-annotations.circuit.json",
      import.meta.url,
    ),
  ).json()
}

test.failing("exports the real TI PMP22712 board annotations without a dummy component", async () => {
  const elements = await loadBoard()
  const standalone = elements.filter(
    (element) =>
      element.pcb_component_id === "pcb_component_altium_board_graphics",
  )
  expect(standalone).toHaveLength(5)
  const { pcb } = await extractArchive(elements)
  expect(pcb.components).toHaveLength(
    elements.filter((element) => element.type === "pcb_component").length,
  )
  const dimensions = pcb.getRecordsByKind("Dimension")
  expect(dimensions).toHaveLength(3)
  expect(
    dimensions.every(
      (dimension) => pcb.getComponentForRecord(dimension) === undefined,
    ),
  ).toBe(true)
  expectValidPcb(pcb)
})

test("snapshots the real TI PMP22712 standalone annotation export", async () => {
  const elements = await loadBoard()
  let convertedSvg: string
  try {
    const { pcb } = await extractArchive(elements)
    convertedSvg = serializeAltiumPcbToSvg(pcb, {
      width: 800,
      height: 700,
      viewBox: { x: 700, y: 150, width: 1900, height: 2100 },
    })
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !==
        "PCB annotation references missing component pcb_component_altium_board_graphics"
    )
      throw error
    convertedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#071a16"/><text x="40" y="260" fill="#f8fafc" font-family="Arial, sans-serif" font-size="28">Export blocked</text><text x="40" y="310" fill="#f8fafc" font-family="Arial, sans-serif" font-size="20">Standalone annotations reference a missing component.</text></svg>`
  }
  await expect(convertedSvg).toMatchSvgSnapshot(import.meta.path)
})
