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

test("removes the contained C4 wire that creates an extra native junction", () => {
  expect(
    exportEdges([
      { from: { x: 4.8, y: 8.68 }, to: { x: 4.8, y: 9.7 } },
      { from: { x: 4.8, y: 8.88 }, to: { x: 4.8, y: 8.68 } },
      { from: { x: 4.8, y: 8.6 }, to: { x: 4.8, y: 8.68 } },
      { from: { x: 5.6, y: 8.88 }, to: { x: 4.8, y: 8.88 } },
    ]),
  ).toEqual([
    [
      { x: 96, y: 174 },
      { x: 96, y: 194 },
    ],
    [
      { x: 96, y: 172 },
      { x: 96, y: 174 },
    ],
    [
      { x: 112, y: 178 },
      { x: 96, y: 178 },
    ],
  ])
})

test("merges partial diagonal overlaps but preserves parallel and crossing wires", () => {
  expect(
    exportEdges([
      { from: { x: 0, y: 0 }, to: { x: 2, y: 2 } },
      { from: { x: 3, y: 3 }, to: { x: 1, y: 1 } },
      { from: { x: 0, y: 1 }, to: { x: 2, y: 3 } },
      { from: { x: 1, y: 0 }, to: { x: 1, y: 3 } },
      { from: { x: 3, y: 3 }, to: { x: 4, y: 4 } },
    ]),
  ).toEqual([
    [
      { x: 0, y: 0 },
      { x: 20, y: 20 },
    ],
    [
      { x: 20, y: 20 },
      { x: 60, y: 60 },
    ],
    [
      { x: 0, y: 20 },
      { x: 40, y: 60 },
    ],
    [
      { x: 20, y: 0 },
      { x: 20, y: 60 },
    ],
    [
      { x: 60, y: 60 },
      { x: 80, y: 80 },
    ],
  ])
})

test("overlap cleanup retains a connected crossing originally defined by a wire end", () => {
  const records = createSchematicWireRecords({
    circuitToAltiumSchematicPoint: (point) => point,
    schematicElements: [
      {
        type: "schematic_trace",
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 3, y: 0 } },
          { from: { x: 1, y: 0 }, to: { x: 4, y: 0 } },
          { from: { x: 3, y: -1 }, to: { x: 3, y: 1 } },
        ],
      },
    ],
  })
  const document = parseAltiumSchDoc(
    "|RECORD=31|CUSTOMX=20|CUSTOMY=20\n" +
      records.map((fields) => `|${fields.join("|")}`).join("\n"),
  )
  expect(document.wires.map(getSchematicRecordPoints)).toEqual([
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ],
    [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ],
    [
      { x: 3, y: -1 },
      { x: 3, y: 1 },
    ],
  ])
})
