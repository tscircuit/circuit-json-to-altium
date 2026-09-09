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
    { color: 132, justification: 3, orientation: 1, text: "BOTTOM" },
    { color: 132, justification: 3, orientation: 0, text: "LEFT" },
    { color: 132, justification: 5, orientation: 0, text: "RIGHT" },
    { color: 132, justification: 5, orientation: 1, text: "TOP" },
  ])
  expect(
    schematic.netLabels.some((label) => label.getBoolean("ISHIDDEN")),
  ).toBe(false)

  const internalWires = schematic
    .getRecordsByKind("27")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNW"))
  const displayPolygons = schematic
    .getRecordsByKind("7")
    .filter((record) => record.getDecoded("UNIQUEID")?.startsWith("CJNP"))
  const displayLabels = schematic
    .getRecordsByKind("25")
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
      labelAnchor: getSchematicRecordPoints(internalWires[index]!)[0],
      pointCount: getSchematicRecordPoints(polygon).length,
    })),
  ).toEqual(
    internalWires.map((wire) => ({
      anchor: getSchematicRecordPoints(wire)[0],
      fillColor: 0xf8_fc_ff,
      labelAnchor: getSchematicRecordPoints(wire)[0],
      pointCount: 5,
    })),
  )

  for (const [index, wire] of internalWires.entries()) {
    expect(getSchematicRecordPoints(wire)[1]).toEqual(
      schematic.netLabels[index]!.position!,
    )
  }

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
    /<text data-record="25"[^>]*>TOP<\/text>/u,
  )?.[0]
  expect(topText).toContain('text-anchor="end"')
  expect(topText).toContain("rotate(-90)")
  expectValidSchematic(schematic)
})
