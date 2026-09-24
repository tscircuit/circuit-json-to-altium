import { expect, test } from "bun:test"
import { type AltiumSchDoc, getSchematicRecordPoints } from "altiumts"
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

test("fits large pointed-label text inside its outline on every anchor side", async () => {
  const elements: CircuitElement[] = [board()]
  for (const [index, anchorSide] of anchorSides.entries()) {
    const anchorPosition = { x: index * 5, y: 0 }
    const centerOffset = centerOffsetByAnchorSide[anchorSide]
    elements.push(
      {
        type: "schematic_net_label",
        schematic_net_label_id: `large-${anchorSide}`,
        source_net_id: `net-${anchorSide}`,
        anchor_position: anchorPosition,
        center: {
          x: anchorPosition.x + centerOffset.x,
          y: anchorPosition.y + centerOffset.y,
        },
        anchor_side: anchorSide,
        text: "WWWWWW",
      },
      {
        type: "schematic_text",
        schematic_text_id: `large-${anchorSide}-text`,
        position: anchorPosition,
        text: "WWWWWW",
        font_size: 0.5,
        anchor: "center",
      },
    )
  }
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const outlines = schematic
    .getRecordsByKind("7")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNP"))
  const labels = schematic
    .getRecordsByKind("25")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNT"))
  expect(outlines).toHaveLength(4)
  expect(labels).toHaveLength(4)
  for (const [index, anchorSide] of anchorSides.entries()) {
    const points = getSchematicRecordPoints(outlines[index]!)
    const anchor = getSchematicRecordPoints(outlines[index]!)[0]!
    const direction = centerOffsetByAnchorSide[anchorSide]
    const along = (point: { x: number; y: number }) =>
      2 *
      ((point.x - anchor.x) * direction.x + (point.y - anchor.y) * direction.y)
    const across = (point: { x: number; y: number }) =>
      2 *
      (-(point.x - anchor.x) * direction.y + (point.y - anchor.y) * direction.x)
    expect(points[0]).toEqual(anchor)
    expect(Math.min(...points.map(along))).toBe(0)
    expect(Math.max(...points.map(along))).toBeGreaterThan(50)
    expect(
      Math.max(...points.map(across)) - Math.min(...points.map(across)),
    ).toBeGreaterThan(10)
    const label = labels[index]!
    const textPosition = {
      x: label.getNumber("LOCATION.X")!,
      y: label.getNumber("LOCATION.Y")!,
    }
    expect(along(textPosition)).toBeGreaterThan(2)
    expect(across(textPosition)).toBe(0)
    expect(
      schematic
        .getRecordsByKind("31")[0]
        ?.getNumber(`SIZE${label.getNumber("FONTID")}`),
    ).toBe(10)
    expect(schematic.netLabels[index]?.getBoolean("ISHIDDEN")).not.toBe(true)
  }
  expectValidSchematic(schematic)
})
