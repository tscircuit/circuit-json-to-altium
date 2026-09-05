import { expect, test } from "bun:test"
import {
  type AltiumSchDoc,
  getSchematicRecordPoints,
  serializeAltiumSheetToSvg,
} from "altiumts"
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

test("positions net-label text from its Circuit JSON anchor side", async () => {
  const elements: CircuitElement[] = [
    board(),
    ...anchorSides.map((anchorSide, index) => {
      const anchorPosition = { x: index * 2, y: 0 }
      const centerOffset = centerOffsetByAnchorSide[anchorSide]
      return {
        type: "schematic_net_label",
        schematic_net_label_id: `label-${anchorSide}`,
        source_net_id: `net-${anchorSide}`,
        center: {
          x: anchorPosition.x + centerOffset.x,
          y: anchorPosition.y + centerOffset.y,
        },
        anchor_position: anchorPosition,
        anchor_side: anchorSide,
        text: anchorSide.toUpperCase(),
      }
    }),
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc

  expect(
    schematic.netLabels.map((label) => ({
      color: label.getNumber("COLOR"),
      justification: label.getNumber("JUSTIFICATION"),
      orientation: label.getNumber("ORIENTATION"),
      text: label.getDecoded("TEXT"),
    })),
  ).toEqual([
    { color: 132, justification: 1, orientation: 0, text: "BOTTOM" },
    { color: 132, justification: 3, orientation: 0, text: "LEFT" },
    { color: 132, justification: 5, orientation: 0, text: "RIGHT" },
    { color: 132, justification: 7, orientation: 0, text: "TOP" },
  ])
  expect(
    schematic.netLabels.every((label) => label.getBoolean("ISHIDDEN")),
  ).toBe(true)

  const displayPolygons = schematic
    .getRecordsByKind("7")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNP"))
  const displayLabels = schematic
    .getRecordsByKind("4")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNT"))
  expect(displayLabels.map((label) => label.getDecoded("TEXT"))).toEqual([
    "BOTTOM",
    "LEFT",
    "RIGHT",
    "TOP",
  ])
  expect(
    displayPolygons.map((polygon, index) => ({
      anchor: getSchematicRecordPoints(polygon)[0],
      fillColor: polygon.getNumber("AREACOLOR"),
      labelAnchor: schematic.netLabels[index]?.position,
      pointCount: getSchematicRecordPoints(polygon).length,
    })),
  ).toEqual(
    schematic.netLabels.map((label) => ({
      anchor: label.position,
      fillColor: 0xf8_fc_ff,
      labelAnchor: label.position,
      pointCount: 5,
    })),
  )

  const rightOutline = getSchematicRecordPoints(displayPolygons[2]!)
  expect({
    height:
      Math.max(...rightOutline.map((point) => point.y)) -
      Math.min(...rightOutline.map((point) => point.y)),
    width:
      Math.max(...rightOutline.map((point) => point.x)) -
      Math.min(...rightOutline.map((point) => point.x)),
  }).toEqual({ height: 4, width: 20 })
  const topText = serializeAltiumSheetToSvg(schematic).match(
    /<text data-record="4"[^>]*>TOP<\/text>/u,
  )?.[0]
  expect(topText).toContain('text-anchor="end"')
  expect(topText).toContain("rotate(-90)")
  expectValidSchematic(schematic)
})

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
    .getRecordsByKind("4")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNT"))
  expect(outlines).toHaveLength(4)
  expect(labels).toHaveLength(4)
  for (const [index, anchorSide] of anchorSides.entries()) {
    const points = getSchematicRecordPoints(outlines[index]!)
    const anchor = schematic.netLabels[index]!.position!
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
    expect(schematic.netLabels[index]?.getBoolean("ISHIDDEN")).toBe(true)
  }
  expectValidSchematic(schematic)
})
