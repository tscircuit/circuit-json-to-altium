import { expect, test } from "bun:test"
import {
  type AltiumRecord,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
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
test("removes redundant wires from the TPS61288 supply without changing its connections or pin text", async () => {
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
      .filter((kind): kind is string => kind !== undefined && kind !== "27"),
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
  expect(
    doc
      .getRecordsByKind("29")
      .map((junction) => [
        junction.getNumber("LOCATION.X"),
        junction.getNumber("LOCATION.Y"),
      ]),
  ).toEqual(
    before
      .getRecordsByKind("29")
      .map((junction) => [
        junction.getNumber("LOCATION.X"),
        junction.getNumber("LOCATION.Y"),
      ]),
  )
  expect(doc.getRecordsByKind("29")).toHaveLength(41)
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
