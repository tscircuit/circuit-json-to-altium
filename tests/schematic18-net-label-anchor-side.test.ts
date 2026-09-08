import { expect, test } from "bun:test"
import { type AltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

const anchorSides = ["bottom", "left", "right", "top"] as const
const centerOffsetByAnchorSide = {
  bottom: { x: 0, y: 0.5 },
  left: { x: 0.5, y: 0 },
  right: { x: -0.5, y: 0 },
  top: { x: 0, y: -0.5 },
}

function elements(fontSize?: number): CircuitElement[] {
  return [
    board(),
    ...anchorSides.flatMap((anchorSide, index) => {
      const anchorPosition = { x: index * 2, y: 0 }
      const offset = centerOffsetByAnchorSide[anchorSide]
      const text = `${anchorSide.toUpperCase()}${fontSize ? "_LONG_SIGNAL" : ""}`
      return [
        {
          type: "schematic_net_label",
          schematic_net_label_id: `label-${anchorSide}`,
          source_net_id: `net-${anchorSide}`,
          center: {
            x: anchorPosition.x + offset.x,
            y: anchorPosition.y + offset.y,
          },
          anchor_position: anchorPosition,
          anchor_side: anchorSide,
          text,
        },
        {
          type: "schematic_trace",
          schematic_trace_id: `trace-${anchorSide}`,
          edges: [{ from: anchorPosition, to: { x: anchorPosition.x, y: -1 } }],
        },
        ...(fontSize
          ? [
              {
                type: "schematic_text",
                schematic_text_id: `text-${anchorSide}`,
                position: anchorPosition,
                text,
                font_size: fontSize,
                anchor: "center",
              },
            ]
          : []),
      ]
    }),
  ]
}

test("renders each net label once at its electrical anchor for every side", async () => {
  const { schematics } = await extractArchive(elements())
  const doc = schematics[0] as AltiumSchDoc
  expect(
    doc.netLabels.map((label) => ({
      text: label.getDecoded("TEXT"),
      color: label.getNumber("COLOR"),
      orientation: label.getNumber("ORIENTATION"),
      justification: label.getNumber("JUSTIFICATION"),
    })),
  ).toEqual([
    { text: "BOTTOM", color: 132, orientation: 1, justification: 3 },
    { text: "LEFT", color: 132, orientation: 0, justification: 3 },
    { text: "RIGHT", color: 132, orientation: 0, justification: 5 },
    { text: "TOP", color: 132, orientation: 1, justification: 5 },
  ])
  expect(doc.getRecordsByKind("4")).toHaveLength(0)
  expect(doc.getRecordsByKind("7")).toHaveLength(0)
  const wires = doc.getRecordsByKind("27")
  const svg = serializeAltiumSheetToSvg(doc)
  for (const [index, label] of doc.netLabels.entries()) {
    expect(label.getBoolean("ISHIDDEN")).not.toBe(true)
    expect(label.getNumber("LOCATION.X")).toBe(wires[index]?.getNumber("X1"))
    expect(label.getNumber("LOCATION.Y")).toBe(wires[index]?.getNumber("Y1"))
    expect(svg.split(`>${label.getDecoded("TEXT")}</text>`)).toHaveLength(2)
  }
  expectValidSchematic(doc)
})

test("keeps explicit large-label text as a single visible native net label", async () => {
  const { schematics } = await extractArchive(elements(0.5))
  const doc = schematics[0] as AltiumSchDoc
  expect(doc.netLabels).toHaveLength(4)
  expect(doc.getRecordsByKind("4")).toHaveLength(0)
  expect(doc.getRecordsByKind("7")).toHaveLength(0)
  const svg = serializeAltiumSheetToSvg(doc)
  for (const label of doc.netLabels) {
    expect(
      doc
        .getRecordsByKind("31")[0]
        ?.getNumber(`SIZE${label.getNumber("FONTID")}`),
    ).toBe(10)
    expect(label.getBoolean("ISHIDDEN")).not.toBe(true)
    expect(svg.split(`>${label.getDecoded("TEXT")}</text>`)).toHaveLength(2)
  }
  expectValidSchematic(doc)
})
