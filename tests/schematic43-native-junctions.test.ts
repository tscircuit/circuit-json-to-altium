import { expect, test } from "bun:test"
import { resolve } from "node:path"
import {
  type AltiumSchDoc,
  getSchematicRecordPoints,
  parseAltiumFile,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { getRecordLocation } from "./fixtures/altium-schematic-coordinate-utils"
import { convertAltiumSchematicToCircuitJson } from "./fixtures/convert-altium-schematic-to-circuit-json"

test("exports smallest sheet-level junctions on the real Cobra MLX90640 board", async () => {
  const source = parseAltiumFile(
    new Uint8Array(
      await Bun.file(
        resolve(import.meta.dir, "../references/cobra-mlx90640.SchDoc"),
      ).arrayBuffer(),
    ),
  ).document as AltiumSchDoc
  const sourceJunctions = source.getRecordsByKind("29")
  expect(sourceJunctions).toHaveLength(4)
  for (const junction of sourceJunctions) {
    expect(junction.getNumber("OWNERPARTID")).toBe(-1)
    expect(junction.getNumber("INDEXINSHEET")).toBe(-1)
  }

  const circuit = convertAltiumSchematicToCircuitJson(source)
  const traces = circuit.filter((element) => element.type === "schematic_trace")
  const firstEdge = (
    traces[0]!.edges as Array<{
      from: { x: number; y: number }
      to: { x: number; y: number }
    }>
  )[0]!
  circuit.push({
    type: "schematic_trace",
    schematic_trace_id: "duplicate-source-wire",
    edges: [
      firstEdge,
      { from: firstEdge.to, to: firstEdge.from },
      { from: firstEdge.from, to: firstEdge.from },
    ],
    junctions: [],
  })
  const converter = new CircuitJsonToAltiumConverter(circuit, {
    projectName: "cobra-native-junctions",
    schematicSheets: [
      { width: 75, height: 47.5, circuitOrigin: { x: 0, y: 0 } },
    ],
  })
  converter.runUntilFinished()
  const output = converter.getOutput().schematics[0]!
  const document = parseAltiumFile(output.content).document as AltiumSchDoc
  const junctions = document.getRecordsByKind("29")
  expect(junctions).toHaveLength(sourceJunctions.length)
  expect(junctions.map(getRecordLocation)).toEqual(
    sourceJunctions.map(getRecordLocation),
  )
  for (const junction of junctions) {
    expect(junction.getNumber("SIZE")).toBe(0)
    expect(junction.getNumber("COLOR")).toBe(34816)
    expect(junction.getNumber("OWNERPARTID")).toBe(-1)
    expect(junction.getNumber("INDEXINSHEET")).toBe(
      document.records.indexOf(junction),
    )
    expect(document.getParent(junction)).toBeUndefined()
  }

  // Every real wire segment and endpoint survives; none of the redundant ones do.
  const sourceSegments = source.wires.flatMap((wire) => {
    const points = getSchematicRecordPoints(wire)
    return points.slice(1).map((point, index) => [points[index]!, point])
  })
  expect(document.wires.map(getSchematicRecordPoints)).toEqual(sourceSegments)
})
