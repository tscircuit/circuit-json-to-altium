import { expect, test } from "bun:test"
import {
  isAltiumPcbCopperLayerName,
  isKnownAltiumPcbLayerName,
  parseAltiumBinaryPcbDoc,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, expectValidPcb } from "./fixtures"

function getBoardStackTotalThicknessMm(
  document: ReturnType<typeof parseAltiumBinaryPcbDoc>,
): number {
  const entries = document.board?.layerStack.entries ?? []
  let totalMm = 0
  for (const entry of entries) {
    if (
      entry.name &&
      isAltiumPcbCopperLayerName(entry.name, document.board?.layerStack) &&
      entry.copperThickness
    ) {
      totalMm += entry.copperThickness.toMillimeters()
    }
    if (
      entry.name &&
      /^DIELECTRIC/iu.test(entry.name) &&
      entry.dielectricHeight
    ) {
      totalMm += entry.dielectricHeight.toMillimeters()
    }
  }
  return totalMm
}

test("records layer names and 2-layer 1.6mm stackup in Board6", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board({ width: 50, height: 30, thickness: 1.6, num_layers: 2 }),
  ])
  converter.runUntilFinished()

  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const boardRecord = document.board
  expect(boardRecord).toBeDefined()

  expect(boardRecord?.getCaseInsensitive("LAYER1NAME")).toBe("Top Layer")
  expect(boardRecord?.getCaseInsensitive("LAYER32NAME")).toBe("Bottom Layer")
  expect(boardRecord?.getCaseInsensitive("LAYER33NAME")).toBe("Top Overlay")
  expect(boardRecord?.getCaseInsensitive("LAYER34NAME")).toBe("Bottom Overlay")
  expect(boardRecord?.getCaseInsensitive("LAYER74NAME")).toBe("Multi-Layer")
  expect(boardRecord?.getCaseInsensitive("LAYER1PREV")).toBe("0")
  expect(boardRecord?.getCaseInsensitive("LAYER1NEXT")).toBe("32")
  expect(boardRecord?.getCaseInsensitive("LAYER32PREV")).toBe("1")
  expect(boardRecord?.getCaseInsensitive("LAYER32NEXT")).toBe("0")

  const stack = boardRecord!.layerStack
  const signalCopperEntries = stack.entries.filter(
    (entry) =>
      entry.copperThickness !== undefined &&
      entry.name !== undefined &&
      isAltiumPcbCopperLayerName(entry.name, stack),
  )
  expect(signalCopperEntries.map((entry) => entry.name)).toEqual([
    "Top Layer",
    "Bottom Layer",
  ])
  expect(isAltiumPcbCopperLayerName("Top Layer", stack)).toBe(true)
  expect(isAltiumPcbCopperLayerName("Bottom Layer", stack)).toBe(true)
  expect(isAltiumPcbCopperLayerName("Multi-Layer", stack)).toBe(true)
  expect(isAltiumPcbCopperLayerName("Dielectric 1", stack)).toBe(false)
  expect(isAltiumPcbCopperLayerName("Top Overlay", stack)).toBe(false)
  expect(isKnownAltiumPcbLayerName("Top Overlay", stack)).toBe(true)
  expect(getBoardStackTotalThicknessMm(document)).toBeCloseTo(1.6, 2)
})

test("records 4-layer stackup with declared board thickness", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board({ width: 40, height: 25, thickness: 1.2, num_layers: 4 }),
  ])
  converter.runUntilFinished()

  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const boardRecord = document.board
  const stack = boardRecord!.layerStack
  const signalCopperEntries = stack.entries.filter(
    (entry) =>
      entry.copperThickness !== undefined &&
      entry.name !== undefined &&
      isAltiumPcbCopperLayerName(entry.name, stack),
  )
  expect(signalCopperEntries.map((entry) => entry.name)).toEqual([
    "Top Layer",
    "Mid-Layer 1",
    "Mid-Layer 2",
    "Bottom Layer",
  ])
  expect(boardRecord?.getCaseInsensitive("LAYER1NEXT")).toBe("2")
  expect(boardRecord?.getCaseInsensitive("LAYER2NEXT")).toBe("3")
  expect(boardRecord?.getCaseInsensitive("LAYER3NEXT")).toBe("32")
  expect(getBoardStackTotalThicknessMm(document)).toBeCloseTo(1.2, 2)
  expectValidPcb(document)
})

test("validates a routed board with pads, vias, traces, and silkscreen against Board6 stack", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board({ width: 30, height: 20, thickness: 1.6, num_layers: 2 }),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: -4,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "t1",
      route: [
        { route_type: "wire", x: -4, y: 0, width: 0.25, layer: "top" },
        {
          route_type: "via",
          x: 0,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
        },
        { route_type: "wire", x: 4, y: 0, width: 0.25, layer: "bottom" },
      ],
    },
    {
      type: "pcb_via",
      pcb_via_id: "v1",
      x: 0,
      y: 0,
      outer_diameter: 0.6,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "txt1",
      text: "R1",
      anchor_position: { x: -4, y: 2 },
      layer: "top",
      font: "tscircuit2024",
      font_size: 1,
    },
  ])
  converter.runUntilFinished()

  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  expectValidPcb(document)
})
