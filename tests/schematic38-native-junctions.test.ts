import { expect, test } from "bun:test"
import {
  type AltiumRecord,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { getSchematicAutoJunctionPoints } from "../lib/get-schematic-auto-junction-points"
import { expectValidSchematic } from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { getSchematicRoundTripMetrics } from "./fixtures/get-schematic-round-trip-metrics"

function segmentKey(wire: AltiumRecord): string {
  return getSchematicRecordPoints(wire)
    .map(({ x, y }) => `${x}:${y}`)
    .sort()
    .join(";")
}

// Real TI TPS61288 supply circuit: tscircuit/ti at fe07a1a, evaluated with
// @tscircuit/core 0.0.1787 and PCB/parts/routing/DRC/simulation disabled.
// https://github.com/tscircuit/ti/blob/fe07a1a/lib/subcircuits/USBC_PowerDeliveryProgrammablePowerSupply_TPS61288.circuit.tsx
// The baseline SchDoc was exported by converter a55f715 before wire cleanup.
test("exports green manual junctions at TPS61288 native connections without changing wiring or pin text", async () => {
  const source = await Bun.file(
    new URL("./assets/ti-tps61288-power-supply.circuit.json", import.meta.url),
  ).json()
  const before = parseAltiumSchDoc(
    await Bun.file(
      new URL("./assets/ti-tps61288-junctions-before.SchDoc", import.meta.url),
    ).bytes(),
  )
  const converter = new CircuitJsonToAltiumConverter(source, {
    projectName: "tps61288-junctions",
  })
  converter.runUntilFinished()
  const content = converter.getOutput().schematics[0]!.content
  expect(content).toEqual(
    await Bun.file(
      new URL("./assets/ti-tps61288-junctions-cleaned.SchDoc", import.meta.url),
    ).bytes(),
  )
  const doc = parseAltiumSchDoc(content)
  expectValidSchematic(doc)
  expect(doc.components).toHaveLength(65)
  expect(doc.pins).toHaveLength(145)
  expect(before.wires).toHaveLength(490)
  expect(doc.wires).toHaveLength(436)
  expect(new Set(doc.wires.map(segmentKey)).size).toBe(doc.wires.length)
  for (const wire of doc.wires) {
    const [start, end] = getSchematicRecordPoints(wire)
    expect(start).not.toEqual(end)
  }

  // Duplicates and zero-length segments do not add a conducting path. Every
  // distinct nonzero segment, including the hairline pin stems, must survive.
  const conductingSegments = before.wires.filter((wire) => {
    const [start, end] = getSchematicRecordPoints(wire)
    return start!.x !== end!.x || start!.y !== end!.y
  })
  expect(new Set(doc.wires.map(segmentKey))).toEqual(
    new Set(conductingSegments.map(segmentKey)),
  )
  for (const kind of new Set(
    before.records
      .map((record) => record.recordKind)
      .filter(
        (kind): kind is string =>
          kind !== undefined && kind !== "27" && kind !== "29",
      ),
  )) {
    const fields = (records: AltiumRecord[]) =>
      records.map((record) =>
        record.fields
          .filter(({ key }) => key !== "OWNERINDEX")
          .map(({ key, value }) => [key, value]),
      )
    expect(fields(doc.getRecordsByKind(kind))).toEqual(
      fields(before.getRecordsByKind(kind)),
    )
  }
  const junctions = doc.getRecordsByKind("29")
  const junctionPoints = junctions.map((junction) => [
    junction.getNumber("LOCATION.X"),
    junction.getNumber("LOCATION.Y"),
  ])
  for (const junction of before.getRecordsByKind("29")) {
    expect(junctionPoints).toContainEqual([
      junction.getNumber("LOCATION.X"),
      junction.getNumber("LOCATION.Y"),
    ])
  }
  // All 87 positions were observed in native Altium Viewer, including 46
  // auto-junctions absent from Circuit JSON's explicit junction arrays.
  expect(junctions).toHaveLength(87)
  for (const junction of junctions) {
    expect(junction.getBoolean("LOCKED")).toBe(true)
    expect(junction.getNumber("SIZE")).toBe(0)
    expect(junction.getNumber("COLOR")).toBe(34816)
  }
  await expect(
    createSideBySideSvg(
      convertCircuitJsonToSchematicSvg(source),
      serializeAltiumSheetToSvg(doc),
      {
        source: "Circuit JSON: TI TPS61288 power supply",
        converted: "Altium format preview (local altiumts renderer)",
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("finds native T connections without connecting interior wire crossings or label text", () => {
  const ascii = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31",
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=0|X2=20|Y2=0",
    "|RECORD=27|LOCATIONCOUNT=2|X1=10|Y1=0|X2=10|Y2=10",
    "|RECORD=27|LOCATIONCOUNT=2|X1=5|Y1=-5|X2=5|Y2=5",
    "|RECORD=25|LOCATION.X=15|LOCATION.Y=0|TEXT=LABEL",
    // Electrical end is (30, 0), not the pin body at (25, 0).
    "|RECORD=2|LOCATION.X=25|LOCATION.Y=0|PINLENGTH=5|PINCONGLOMERATE=32",
    "|RECORD=27|LOCATIONCOUNT=2|X1=30|Y1=-5|X2=30|Y2=5",
    "|RECORD=17|LOCATION.X=40|LOCATION.Y=0|TEXT=VDD",
    "|RECORD=27|LOCATIONCOUNT=2|X1=40|Y1=-5|X2=40|Y2=5",
    // A plain degree-two bend does not need a junction.
    "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=0|X2=55|Y2=0",
    "|RECORD=27|LOCATIONCOUNT=2|X1=55|Y1=0|X2=55|Y2=5",
  ].join("\r\n")
  expect(getSchematicAutoJunctionPoints(ascii)).toEqual([
    { x: 10, y: 0 },
    { x: 30, y: 0 },
    { x: 40, y: 0 },
  ])
})

test("deduplicates reversed and rounded trace edges separately on each sheet", () => {
  const converter = new CircuitJsonToAltiumConverter(
    ["sheet-a", "sheet-b"].flatMap((id) => [
      { type: "schematic_sheet", schematic_sheet_id: id, name: id },
      {
        type: "schematic_trace",
        schematic_sheet_id: id,
        schematic_trace_id: `${id}-trace`,
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
          { from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
          { from: { x: 0.001, y: 0 }, to: { x: 1.001, y: 0 } },
          { from: { x: 1, y: 0 }, to: { x: 1.001, y: 0 } },
          { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
          { from: { x: 1, y: 0 }, to: { x: 2, y: 1 } },
        ],
        junctions: [{ x: 1, y: 0 }],
      },
    ]),
    {
      schematicSheets: ["sheet-a", "sheet-b"].map((schematicSheetId) => ({
        schematicSheetId,
        width: 10,
        height: 10,
        circuitOrigin: { x: 0, y: 0 },
      })),
    },
  )
  converter.runUntilFinished()
  const sheets = converter.getOutput().schematics.slice(1)
  expect(sheets).toHaveLength(2)
  for (const file of sheets) {
    const doc = parseAltiumSchDoc(file.content)
    expectValidSchematic(doc)
    expect(doc.wires.map(getSchematicRecordPoints)).toEqual([
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      [
        { x: 20, y: 0 },
        { x: 20, y: 20 },
      ],
      [
        { x: 20, y: 0 },
        { x: 40, y: 20 },
      ],
    ])
    expect(doc.getRecordsByKind("29")).toHaveLength(1)
  }
})

test("round-trip geometry ignores redundant wires but still detects missing or moved branches", () => {
  const horizontal = { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
  const branch = { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } }
  const geometryDelta = (edges: (typeof horizontal)[]) =>
    getSchematicRoundTripMetrics({
      sourceCircuitJson: [
        {
          type: "schematic_trace",
          edges: [
            horizontal,
            branch,
            horizontal,
            { from: branch.to, to: branch.to },
          ],
        },
      ],
      roundTripCircuitJson: [{ type: "schematic_trace", edges }],
    }).geometryMaxDeltaCircuitUnits
  expect(geometryDelta([horizontal, branch])).toBe(0)
  expect(geometryDelta([horizontal])).toBe(Number.POSITIVE_INFINITY)
  expect(
    geometryDelta([horizontal, { from: branch.from, to: { x: 1, y: 2 } }]),
  ).toBe(1)
})

test("round-trip geometry permits added native junctions but detects missing or moved source junctions", () => {
  const edges = [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }]
  const geometryDelta = (junctions: { x: number; y: number }[]) =>
    getSchematicRoundTripMetrics({
      sourceCircuitJson: [
        { type: "schematic_trace", edges, junctions: [{ x: 1, y: 0 }] },
      ],
      roundTripCircuitJson: [{ type: "schematic_trace", edges, junctions }],
    }).geometryMaxDeltaCircuitUnits
  expect(
    geometryDelta([
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ]),
  ).toBe(0)
  expect(geometryDelta([])).toBe(Number.POSITIVE_INFINITY)
  expect(geometryDelta([{ x: 2, y: 0 }])).toBe(1)
})
