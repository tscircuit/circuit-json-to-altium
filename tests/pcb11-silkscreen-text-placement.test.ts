import { expect, test } from "bun:test"
import { AltiumTextRecord } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

const anchorAlignments = [
  "top_left",
  "center_left",
  "bottom_left",
  "top_center",
  "center",
  "bottom_center",
  "top_right",
  "center_right",
  "bottom_right",
] as const

test("preserves silkscreen text anchors, mirroring, and content", async () => {
  const silkscreenTexts: CircuitElement[] = anchorAlignments.map(
    (anchorAlignment, index) => ({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: `text_${index}`,
      pcb_component_id: "pc1",
      layer: index >= 7 ? "bottom" : "top",
      anchor_position: { x: index - 4, y: index - 4 },
      anchor_alignment: anchorAlignment,
      text: index === 0 ? "  First line\nΩ second line" : anchorAlignment,
      font: "tscircuit2024",
      font_size: 0.8,
      is_mirrored: index === 0 ? true : index === 8 ? false : undefined,
    }),
  )
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("sc1", "U1"),
    pcbComponent({ pcbComponentId: "pc1", sourceComponentId: "sc1" }),
    ...silkscreenTexts,
  ]

  const { pcb } = await extractArchive(elements)
  const texts = pcb.getRecordsByKind("Text")

  expect(texts).toHaveLength(9)
  expect(texts.map((text) => text.get("JUSTIFICATION"))).toEqual([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
  ])
  expect(texts[0]).toBeInstanceOf(AltiumTextRecord)
  if (!(texts[0] instanceof AltiumTextRecord)) {
    throw new Error("Expected a typed Altium text record")
  }
  expect(texts[0].text).toBe("  First line\nΩ second line")
  expect(texts[0].mirrored).toBe(true)
  expect(texts[7]?.getBoolean("MIRROR")).toBe(true)
  expect(texts[8]?.getBoolean("MIRROR")).toBe(false)
  expect(texts.map((text) => text.getAltiumMeasurement("Y")?.toMils())).toEqual(
    anchorAlignments.map((_, index) =>
      expect.closeTo(1_000 + (index - 4 + 6) * (1_000 / 25.4), 4),
    ),
  )
  expectValidPcb(pcb)
})
