import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { createCircuitToAltiumPcbPointTransform } from "../lib/create-circuit-to-altium-pcb-point-transform"
import { type CircuitElement, extractArchive } from "./fixtures"

test("snapshots the real NEMA17 board and USB-C polygon pads", async () => {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const { pcb } = await extractArchive(elements)
  const outline = elements.find((element) => element.type === "pcb_board")!
    .outline as { x: number; y: number }[]
  const polygonOwner = elements.find(
    (element) => element.type === "pcb_smtpad" && element.shape === "polygon",
  )!.pcb_component_id
  const points = elements
    .filter(
      (element) =>
        element.type === "pcb_smtpad" &&
        element.shape === "polygon" &&
        element.pcb_component_id === polygonOwner,
    )
    .flatMap((element) => element.points as { x: number; y: number }[])
  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  const center = createCircuitToAltiumPcbPointTransform(outline)({
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  })
  await expect(
    serializeAltiumPcbToSvg(pcb, { width: 800, height: 800 }),
  ).toMatchSvgSnapshot(import.meta.path, "full-board")
  await expect(
    serializeAltiumPcbToSvg(pcb, {
      width: 800,
      height: 400,
      layers: ["TOP"],
      showBoardOutline: false,
      viewBox: { x: center.x - 160, y: center.y - 80, width: 320, height: 160 },
    }),
  ).toMatchSvgSnapshot(import.meta.path, "usb-c")
}, 60_000)
