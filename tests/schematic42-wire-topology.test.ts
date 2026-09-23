import { expect, test } from "bun:test"
import { getSchematicRecordPoints, parseAltiumSchDoc } from "altiumts"
import { createSchematicWireRecords } from "../lib/create-schematic-wire-records"
import type { Point } from "../lib/types"

function exportEdges(edges: Array<{ from: Point; to: Point }>) {
  const records = createSchematicWireRecords({
    circuitToAltiumSchematicPoint: ({ x, y }) => ({
      x: Math.round(x * 20),
      y: Math.round(y * 20),
    }),
    // Repeated edges can occur on different traces sharing the same routed net.
    schematicElements: edges.map((edge) => ({
      type: "schematic_trace",
      edges: [edge],
    })),
  })
  return parseAltiumSchDoc(
    ["|RECORD=31", ...records.map((record) => `|${record.join("|")}`)].join(
      "\n",
    ),
  ).wires.map(getSchematicRecordPoints)
}

test("emits one wire for repeated and reversed edges after coordinate rounding", () => {
  expect(
    exportEdges([
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
      { from: { x: 0.001, y: 0 }, to: { x: 1.001, y: 0 } },
      { from: { x: 0.5, y: 0 }, to: { x: 0.5, y: 1 } },
    ]),
  ).toEqual([
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ],
    [
      { x: 10, y: 0 },
      { x: 10, y: 20 },
    ],
  ])
})

test("omits zero-length wires including edges collapsed by rounding", () => {
  expect(
    exportEdges([
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
      { from: { x: 0, y: 0 }, to: { x: 0.001, y: 0.001 } },
      { from: { x: 0, y: 0 }, to: { x: 0.1, y: 0 } },
    ]),
  ).toEqual([
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
  ])
})

test("preserves branch endpoints and does not split an unconnected crossing", () => {
  const edges = [
    { from: { x: -1, y: 0 }, to: { x: 1, y: 0 } },
    { from: { x: 0, y: -1 }, to: { x: 0, y: 1 } },
    { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
    { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
  ]
  expect(exportEdges(edges)).toEqual(
    edges.map(({ from, to }) =>
      [from, to].map(({ x, y }) => ({ x: x * 20, y: y * 20 })),
    ),
  )
})
