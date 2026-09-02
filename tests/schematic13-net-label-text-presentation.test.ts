import { expect, test } from "bun:test"
import type { AltiumSchDoc } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

const elements: CircuitElement[] = [
  board(),
  {
    type: "schematic_net_label",
    schematic_net_label_id: "signal_label",
    source_net_id: "source_net_signal",
    center: { x: 1, y: 1 },
    anchor_position: { x: 1, y: 1 },
    anchor_side: "left",
    text: "SIGNAL",
  },
  {
    type: "schematic_text",
    schematic_text_id: "signal_label_presentation",
    text: "SIGNAL",
    font_size: 0.18,
    position: { x: 1, y: 1 },
    rotation: -90,
    anchor: "top_right",
    color: "#123456",
  },
  {
    type: "schematic_net_label",
    schematic_net_label_id: "power_label",
    source_net_id: "source_net_vcc",
    center: { x: 4, y: 1 },
    anchor_position: { x: 4, y: 1 },
    anchor_side: "bottom",
    symbol_name: "rail_up",
    text: "VCC",
  },
  {
    type: "schematic_text",
    schematic_text_id: "power_label_presentation",
    text: "VCC",
    font_size: 0.18,
    position: { x: 4, y: 1 },
    rotation: 0,
    anchor: "bottom_left",
    color: "#654321",
  },
  {
    type: "schematic_net_label",
    schematic_net_label_id: "default_label",
    source_net_id: "source_net_default",
    center: { x: 7, y: 1 },
    anchor_position: { x: 7, y: 1 },
    anchor_side: "left",
    text: "DEFAULT_NET",
  },
  {
    type: "schematic_text",
    schematic_text_id: "trace_inline_label",
    source_trace_id: "source_trace_inline",
    text: "TRACE_INLINE",
    font_size: 0.12,
    position: { x: 9, y: 1 },
    rotation: 0,
    anchor: "bottom_left",
    color: "#abcdef",
  },
  {
    type: "schematic_text",
    schematic_text_id: "unrelated_signal_text",
    text: "SIGNAL",
    font_size: 0.18,
    position: { x: 11, y: 1 },
    rotation: 0,
    anchor: "bottom_left",
    color: "#abcdef",
  },
]

test("uses matching schematic text to present native net labels", async () => {
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const sheetRecord = schematic.getRecordsByKind("31")[0]
  const netLabel = schematic.netLabels[0]
  const defaultNetLabel = schematic.netLabels[1]
  const powerPort = schematic.powerPorts[0]
  const sheetLabels = schematic.getRecordsByKind("4")

  expect({
    netLabel: {
      color: netLabel?.getNumber("COLOR"),
      fontSizePoints: sheetRecord?.getNumber(
        `SIZE${netLabel?.getNumber("FONTID") ?? 1}`,
      ),
      justification: netLabel?.getNumber("JUSTIFICATION"),
      orientation: netLabel?.getNumber("ORIENTATION"),
    },
    defaultNetLabel: {
      fontSizePoints: sheetRecord?.getNumber(
        `SIZE${defaultNetLabel?.getNumber("FONTID") ?? 1}`,
      ),
      text: defaultNetLabel?.getDecoded("TEXT"),
    },
    powerPort: {
      color: powerPort?.getNumber("COLOR"),
      fontSizePoints: sheetRecord?.getNumber(
        `SIZE${powerPort?.getNumber("FONTID") ?? 1}`,
      ),
    },
    sheetLabels: sheetLabels.map((label) => ({
      fontSizePoints: sheetRecord?.getNumber(
        `SIZE${label.getNumber("FONTID") ?? 1}`,
      ),
      text: label.getDecoded("TEXT"),
    })),
  }).toEqual({
    defaultNetLabel: {
      fontSizePoints: 4,
      text: "DEFAULT_NET",
    },
    netLabel: {
      color: 0x56_34_12,
      fontSizePoints: 4,
      justification: 8,
      orientation: 1,
    },
    powerPort: {
      color: 0x21_43_65,
      fontSizePoints: 4,
    },
    sheetLabels: [
      { fontSizePoints: 3, text: "TRACE_INLINE" },
      { fontSizePoints: 4, text: "SIGNAL" },
    ],
  })
  expectValidSchematic(schematic)
})
