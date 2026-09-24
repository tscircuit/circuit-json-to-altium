import { expect, test } from "bun:test"
import { getSchematicRecordPoints, parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { appendSchematicConnectionJunctions } from "../lib/append-schematic-connection-junctions"
import { getSchematicConnectionJunctions } from "../lib/get-schematic-connection-junctions"
import type { SchematicWireSegment } from "../lib/normalize-schematic-wire-segments"

const wire = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SchematicWireSegment => ({
  from: { x: x1, y: y1 },
  to: { x: x2, y: y2 },
})

test("finds electrical branches without connecting bare crossings or bends", () => {
  const segments = [
    wire(0, 0, 20, 0),
    wire(10, 0, 10, 10),
    wire(30, 0, 50, 0),
    wire(40, -10, 40, 10),
    wire(60, 0, 70, 0),
    wire(70, 0, 70, 10),
    wire(80, 0, 90, 0),
    wire(90, 0, 90, 10),
  ]
  expect(
    getSchematicConnectionJunctions({ segments, terminals: [{ x: 90, y: 0 }] }),
  ).toEqual([
    { x: 10, y: 0 },
    { x: 90, y: 0 },
  ])
})

test("exports native green junctions for power-port bends and label leaders only once", () => {
  const source = `${[
    "|RECORD=31|CUSTOMX=100|CUSTOMY=100",
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=10|X2=10|Y2=10",
    "|RECORD=27|LOCATIONCOUNT=2|X1=10|Y1=10|X2=10|Y2=20",
    "|RECORD=17|LOCATION.X=10|LOCATION.Y=10|STYLE=4|TEXT=GND",
    "|RECORD=27|LOCATIONCOUNT=2|X1=30|Y1=0|X2=30|Y2=20",
    "|RECORD=27|LOCATIONCOUNT=2|X1=30|Y1=10|X2=31|X2_FRAC=80000|Y2=10",
    "|RECORD=25|LOCATION.X=31|LOCATION.X_FRAC=80000|LOCATION.Y=10|TEXT=FB",
  ].join("\r\n")}\r\n`
  const once = appendSchematicConnectionJunctions(source)
  const doc = parseAltiumSchDoc(once)
  const junctions = doc.getRecordsByKind("29")
  expect(
    junctions.map((r) => [
      r.getNumber("LOCATION.X"),
      r.getNumber("LOCATION.Y"),
    ]),
  ).toEqual([
    [10, 10],
    [30, 10],
  ])
  for (const junction of junctions) {
    expect(junction.getBoolean("LOCKED")).toBe(true)
    expect(junction.getNumber("SIZE")).toBe(0)
    expect(junction.getNumber("COLOR")).toBe(34816)
    expect(junction.getNumber("INDEXINSHEET")).toBe(
      doc.records.indexOf(junction),
    )
  }
  expect(appendSchematicConnectionJunctions(once)).toBe(once)
})

test("matches the 61 automatic junction positions measured on the real TI TPS61288 board", async () => {
  const circuit = await Bun.file(
    new URL("./assets/ti-tps61288-power-supply.circuit.json", import.meta.url),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuit, {
    projectName: "ti-tps61288",
  })
  converter.runUntilFinished()
  const output = converter.getOutput().schematics[0]!.content
  // Keep the downloadable review file identical to the tested converter output.
  expect(output).toEqual(
    await Bun.file(
      new URL("./assets/ti-tps61288-native-junctions.SchDoc", import.meta.url),
    ).bytes(),
  )
  const document = parseAltiumSchDoc(output)
  const segments = document.wires.flatMap((wire) => {
    const points = getSchematicRecordPoints(wire)
    return points.slice(1).map((to, index) => ({ from: points[index]!, to }))
  })
  const terminals = [...document.pins, ...document.powerPorts].flatMap(
    (record) => (record.position ? [record.position] : []),
  )
  // Coordinates observed from the native Viewer's rendered dots, 2026-09-24.
  // This includes branches introduced by label leaders and power ports.
  // Compare the new export in the original measurement units (scale factor 0.3).
  const nativePositions = [
    [115, 220],
    [238, 277],
    [238, 421],
    [246, 270],
    [246, 414],
    [270, 260],
    [270, 404],
    [282, 270],
    [282, 414],
    [290, 246],
    [290, 390],
    [333, 128],
    [382, 262],
    [382, 406],
    [406, 234],
    [406, 378],
    [454, 310],
    [454, 462],
    [466, 422],
    [466, 446],
    [470, 286],
    [470, 310],
    [482, 422],
    [482, 446],
    [486, 286],
    [486, 310],
    [498, 422],
    [498, 446],
    [502, 286],
    [502, 320],
    [510, 422],
    [510, 460],
    [518, 286],
    [518, 320],
    [526, 422],
    [526, 460],
    [534, 286],
    [534, 320],
    [554, 428],
    [554, 450],
    [174, 242],
    [174, 386],
    [282, 360],
    [382, 370],
    [562, 320],
    [282, 216],
    [382, 226],
    [388, 136],
    [246, 352],
    [354, 360],
    [354, 216],
    [382, 458],
    [382, 314],
    [373, 155],
    [174, 408],
    [209, 421],
    [174, 264],
    [209, 277],
    [368, 266],
    [438, 412],
    [438, 268],
  ]
  const predicted = getSchematicConnectionJunctions({ segments, terminals })
  expect(
    predicted
      .map(({ x, y }) => `${(x * 0.3).toFixed(4)}:${(y * 0.3).toFixed(4)}`)
      .sort(),
  ).toEqual(
    nativePositions.map(([x, y]) => `${x!.toFixed(4)}:${y!.toFixed(4)}`).sort(),
  )
  const junctions = document.getRecordsByKind("29")
  expect(junctions).toHaveLength(62) // 61 compiled positions plus one explicit source junction.
  for (const [x, y] of nativePositions) {
    const junction = junctions.find(
      (record) =>
        Math.abs(
          (Number(record.getNumber("LOCATION.X")) +
            Number(record.getNumber("LOCATION.X_FRAC") ?? 0) / 100000) *
            0.3 -
            x!,
        ) < 0.00001 &&
        Math.abs(
          (Number(record.getNumber("LOCATION.Y")) +
            Number(record.getNumber("LOCATION.Y_FRAC") ?? 0) / 100000) *
            0.3 -
            y!,
        ) < 0.00001,
    )
    expect(junction).toBeDefined()
    expect(junction!.getBoolean("LOCKED")).toBe(true)
    expect(junction!.getNumber("COLOR")).toBe(34816)
    expect(junction!.getNumber("SIZE")).toBe(0)
  }
})
