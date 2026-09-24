import { expect, test } from "bun:test"
import { getSchematicRecordPoints, parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { appendSchematicConnectionJunctions } from "../lib/append-schematic-connection-junctions"
import { getSchematicConnectionJunctions } from "../lib/get-schematic-connection-junctions"
import { normalizeSchematicDocumentWires } from "../lib/normalize-schematic-document-wires"
import { normalizeSchematicWireSegments } from "../lib/normalize-schematic-wire-segments"

test("a collinear label leader does not add junctions to a straight wire", () => {
  const converter = new CircuitJsonToAltiumConverter(
    [
      {
        type: "schematic_trace",
        edges: [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }],
        junctions: [],
      },
      { type: "source_net", source_net_id: "n", name: "SIG" },
      {
        type: "schematic_net_label",
        source_net_id: "n",
        text: "SIG",
        center: { x: 1.5, y: 0 },
        anchor_position: { x: 1, y: 0 },
        anchor_side: "left",
      },
    ],
    {
      schematicSheets: [
        { width: 10, height: 10, circuitOrigin: { x: 0, y: 0 } },
      ],
    },
  )
  converter.runUntilFinished()
  const output = converter.getOutput().schematics[0]!
  for (const content of [output.asciiContent, output.content]) {
    const document = parseAltiumSchDoc(content)
    expect(document.wires.map(getSchematicRecordPoints)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
    ])
    expect(document.getRecordsByKind("29")).toHaveLength(0)
    expect(document.netLabels).toHaveLength(1)
    expect(document.netLabels[0]!.position).toEqual({ x: 21.8, y: 0 })
  }
})

test("overlapping segments contribute distinct directions, not record counts", () => {
  const segments = [
    { from: { x: 0, y: 0 }, to: { x: 40, y: 0 } },
    { from: { x: 20, y: 0 }, to: { x: 21.8, y: 0 } },
  ]
  expect(getSchematicConnectionJunctions({ segments })).toEqual([])
  expect(
    getSchematicConnectionJunctions({
      segments: [...segments, { from: { x: 20, y: 0 }, to: { x: 20, y: 10 } }],
    }),
  ).toEqual([{ x: 20, y: 0 }])
})

test("fractional wire cleanup preserves a real T and subsequent record ownership", () => {
  const source = `${[
    "|RECORD=31",
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=0|X2=40|Y2=0|COLOR=34816|LINEWIDTH=0",
    "|RECORD=27|LOCATIONCOUNT=2|X1=20|Y1=0|X2=21|X2_FRAC=80000|Y2=0|COLOR=34816|LINEWIDTH=0",
    "|RECORD=27|LOCATIONCOUNT=2|X1=21|X1_FRAC=80000|Y1=0|X2=21|X2_FRAC=80000|Y2=10|COLOR=34816|LINEWIDTH=0",
    "|RECORD=1|INDEXINSHEET=4|LIBREFERENCE=Example",
    "|RECORD=34|OWNERINDEX=4|OWNERPARTID=-1|TEXT=U1",
    "|RECORD=29|INDEXINSHEET=6|OWNERPARTID=-1|LOCATION.X=10|LOCATION.Y=0|SIZE=0|LOCKED=T",
  ].join("\r\n")}\r\n`
  const result = appendSchematicConnectionJunctions(source)
  expect(appendSchematicConnectionJunctions(result)).toBe(result)
  const document = parseAltiumSchDoc(result)
  expect(document.wires.map(getSchematicRecordPoints)).toEqual([
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    [
      { x: 21.8, y: 0 },
      { x: 21.8, y: 10 },
    ],
  ])
  const component = document.components[0]!
  expect(
    document
      .getOwnedRecords(component)
      .map((record) => record.getDecoded("TEXT")),
  ).toEqual(["U1"])
  expect(component.getNumber("INDEXINSHEET")).toBe(
    document.records.indexOf(component),
  )
  expect(
    document
      .getRecordsByKind("29")
      .map((record) => [
        record.getNumber("LOCATION.X"),
        record.getNumber("LOCATION.X_FRAC") ?? 0,
      ]),
  ).toEqual([
    [10, 0],
    [21, 80000],
  ])
  for (const junction of document.getRecordsByKind("29")) {
    expect(junction.getNumber("INDEXINSHEET")).toBe(
      document.records.indexOf(junction),
    )
  }
})

test("cleanup preserves a connected fractional crossing and leaves bare crossings alone", () => {
  const segments = [
    { from: { x: -0.2, y: -0.3 }, to: { x: 3.1, y: -0.3 } },
    { from: { x: 1.8, y: -0.3 }, to: { x: 4.2, y: -0.3 } },
    { from: { x: 3.1, y: -1 }, to: { x: 3.1, y: 1 } },
    { from: { x: 0, y: -1 }, to: { x: 0, y: 1 } },
  ]
  const normalized = normalizeSchematicWireSegments(segments)
  expect(normalized).toEqual([
    { from: { x: -0.2, y: -0.3 }, to: { x: 3.1, y: -0.3 } },
    { from: { x: 3.1, y: -0.3 }, to: { x: 4.2, y: -0.3 } },
    segments[2]!,
    segments[3]!,
  ])
  expect(getSchematicConnectionJunctions({ segments: normalized })).toEqual([
    { x: 3.1, y: -0.3 },
  ])
})

test("unchanged wire records and owned artwork retain their fields and order", () => {
  const source = `${[
    "|RECORD=31",
    "|RECORD=1|LIBREFERENCE=Example",
    "|RECORD=27|OWNERINDEX=1|LOCATIONCOUNT=2|X1=0|Y1=0|X2=1|Y2=0|UNIQUEID=ART",
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=0|X2=40|Y2=0|COLOR=34816|LINEWIDTH=0|UNIQUEID=WIRE",
  ].join("\r\n")}\r\n`
  expect(normalizeSchematicDocumentWires(source)).toBe(source)
})

test("normalization keeps connected crossings between differently styled wires", () => {
  const source = `${[
    "|RECORD=31",
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=0|X2=20|Y2=0|COLOR=1",
    "|RECORD=27|LOCATIONCOUNT=2|X1=10|Y1=0|X2=30|Y2=0|COLOR=1",
    "|RECORD=27|LOCATIONCOUNT=2|X1=20|Y1=-10|X2=20|Y2=10|COLOR=2",
  ].join("\r\n")}\r\n`
  const doc = parseAltiumSchDoc(appendSchematicConnectionJunctions(source))
  expect(doc.getRecordsByKind("29")).toHaveLength(1)
  expect(doc.wires.map(getSchematicRecordPoints)).toEqual([
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ],
    [
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ],
    [
      { x: 20, y: -10 },
      { x: 20, y: 10 },
    ],
  ])
})
