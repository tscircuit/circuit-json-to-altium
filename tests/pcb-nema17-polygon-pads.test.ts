import { expect, test } from "bun:test"
import {
  AltiumPadRecord,
  AltiumRegionRecord,
  parseAltiumBinaryPcbDoc,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import type { CircuitElement } from "./fixtures"

test("preserves the eight nema17 USB-C polygon pads and openings", async () => {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const polygons = elements.filter(
    (element) => element.type === "pcb_smtpad" && element.shape === "polygon",
  )
  expect(polygons).toHaveLength(8)
  const converter = new CircuitJsonToAltiumConverter(elements, {
    projectName: "nema17",
  })
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const pads = document.records.filter(
    (record): record is AltiumPadRecord => record instanceof AltiumPadRecord,
  )
  const regions = document.records.filter(
    (record): record is AltiumRegionRecord =>
      record instanceof AltiumRegionRecord,
  )
  const smtPads = elements.filter((element) => element.type === "pcb_smtpad")
  const components = elements.filter(
    (element) => element.type === "pcb_component",
  )
  const outline = elements.find((element) => element.type === "pcb_board")!
    .outline as { x: number; y: number }[]
  const offsetX = 25.4 - Math.min(...outline.map((point) => point.x))
  const offsetY = 25.4 - Math.min(...outline.map((point) => point.y))
  const anchors = new Set<string>()
  for (const polygon of polygons) {
    const pad = pads[smtPads.indexOf(polygon)]!
    const points = polygon.points as { x: number; y: number }[]
    const componentIndex = components.findIndex(
      (component) => component.pcb_component_id === polygon.pcb_component_id,
    )
    const port = elements.find(
      (element) =>
        element.type === "pcb_port" &&
        element.pcb_port_id === polygon.pcb_port_id,
    )!
    const sourcePort = elements.find(
      (element) =>
        element.type === "source_port" &&
        element.source_port_id === port.source_port_id,
    )!
    expect(pad.name).toBe(String(sourcePort.pin_number ?? sourcePort.name))
    expect(pad.componentIndex).toBe(componentIndex)
    expect(pad.layer).toBe("TOP")
    const x = pad.position!.x * 0.0254 - offsetX
    const y = pad.position!.y * 0.0254 - offsetY
    expect(x).toBeGreaterThan(Math.min(...points.map((point) => point.x)))
    expect(x).toBeLessThan(Math.max(...points.map((point) => point.x)))
    expect(y).toBeGreaterThan(Math.min(...points.map((point) => point.y)))
    expect(y).toBeLessThan(Math.max(...points.map((point) => point.y)))
    anchors.add(`${x.toFixed(4)},${y.toFixed(4)}`)
    for (const layer of ["TOP", "TOPSOLDER", "TOPPASTE"]) {
      const region = regions.find(
        (record) =>
          record.layer === layer &&
          record.componentIndex === componentIndex &&
          Math.abs(
            record.geometry.outline.vertices[0]!.position.x * 0.0254 -
              offsetX -
              points[0]!.x,
          ) < 0.0001,
      )
      expect(region).toBeDefined()
      if (layer === "TOP") expect(region!.netIndex).toBe(pad.netIndex)
      for (const point of points) {
        expect(
          region!.geometry.outline.vertices.some(
            (vertex) =>
              Math.abs(vertex.position.x * 0.0254 - offsetX - point.x) <
                0.0001 &&
              Math.abs(vertex.position.y * 0.0254 - offsetY - point.y) < 0.0001,
          ),
        ).toBe(true)
      }
    }
  }
  expect(anchors.size).toBe(8)
})
