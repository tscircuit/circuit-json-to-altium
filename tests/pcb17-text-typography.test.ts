import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

test("preserves PCB text font family, weight, and style", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("sc1", "U1"),
    pcbComponent({ pcbComponentId: "pc1", sourceComponentId: "sc1" }),
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "imported_legend",
      pcb_component_id: "pc1",
      layer: "top",
      anchor_position: { x: 0, y: 0 },
      anchor_alignment: "center",
      text: "Imported legend",
      font: "tscircuit2024",
      font_size: 0.8,
      font_family: "Consolas",
      font_weight: "bold",
      font_style: "italic",
    },
  ]

  const { pcb } = await extractArchive(elements)
  const text = pcb.getRecordsByKind("Text")[0]

  expect({
    family: text?.getDecoded("FONTNAME"),
    isBold: text?.getBoolean("BOLD"),
    isItalic: text?.getBoolean("ITALIC"),
  }).toEqual({ family: "Consolas", isBold: true, isItalic: true })
  expectValidPcb(pcb)
  await expect(serializeAltiumPcbToSvg(pcb)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
