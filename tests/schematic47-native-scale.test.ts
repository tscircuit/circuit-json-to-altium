import { expect, test } from "bun:test"
import {
  type AltiumRecord,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
} from "altiumts"
import JSZip from "jszip"
import {
  CircuitJsonToAltiumConverter,
  type CircuitJsonToAltiumConverterOptions,
  convertCircuitJsonToAltiumZip,
} from "../lib"
import {
  board,
  type CircuitElement,
  sourceComponent,
  sourcePort,
} from "./fixtures"

const units = 200 / 3
const coordinate = (r: AltiumRecord, key: string) =>
  (r.getNumber(key) ?? 0) + (r.getNumber(`${key}_FRAC`) ?? 0) / 100_000
const elements: CircuitElement[] = [
  board(),
  sourceComponent("chip", "U1"),
  {
    type: "schematic_component",
    schematic_component_id: "chip",
    source_component_id: "chip",
    center: { x: 0, y: 0 },
    size: { width: 2, height: 2 },
  },
  sourcePort({ sourcePortId: "pin", sourceComponentId: "chip", pinNumber: 1 }),
  {
    type: "schematic_port",
    schematic_port_id: "p",
    schematic_component_id: "chip",
    source_port_id: "pin",
    center: { x: -1.2, y: 0 },
    distance_from_component_edge: 0.2,
    facing_direction: "left",
    display_pin_label: "IN",
  },
  {
    type: "schematic_trace",
    edges: [
      { from: { x: -2, y: 0 }, to: { x: -1.2, y: 0 } },
      { from: { x: -1.5, y: 0 }, to: { x: -1.5, y: 1 } },
    ],
    junctions: [{ x: -1.5, y: 0 }],
  },
  { type: "source_net", source_net_id: "sig", name: "SIG" },
  {
    type: "schematic_net_label",
    source_net_id: "sig",
    text: "SIG",
    center: { x: -2.5, y: 0 },
    anchor_position: { x: -2, y: 0 },
    anchor_side: "right",
  },
  {
    type: "schematic_net_label",
    source_net_id: "vcc",
    text: "VCC",
    center: { x: -1.5, y: 1 },
    anchor_position: { x: -1.5, y: 1 },
    anchor_side: "bottom",
    symbol_name: "rail_up",
  },
]
function convert(options: CircuitJsonToAltiumConverterOptions = {}) {
  const converter = new CircuitJsonToAltiumConverter(elements, {
    schematicSheets: [{ width: 10, height: 10, circuitOrigin: { x: 4, y: 4 } }],
    ...options,
  })
  converter.runUntilFinished()
  return converter.getOutput()
}

test("default native scale converts source geometry and fonts before rounding", async () => {
  const legacy = convert({ schematicUnitsPerCircuitUnit: 20 })
  const scaled = convert()
  expect(convert({ schematicUnitsPerCircuitUnit: units })).toEqual(scaled)
  expect(scaled.pcb.content).toEqual(legacy.pcb.content)
  const archive = await JSZip.loadAsync(
    await convertCircuitJsonToAltiumZip(elements, "default-scale"),
  )
  const zipSheet = parseAltiumSchDoc(
    await archive.file("default-scale.SchDoc")!.async("uint8array"),
  )
  expect(
    zipSheet
      .getRecordsByKind("31")[0]!
      .getNumber(`SIZE${zipSheet.pins[0]!.getNumber("NAME_CUSTOMFONTID")}`),
  ).toBe(10)
  const output = scaled.schematics[0]!
  for (const content of [output.asciiContent, output.content]) {
    const doc = parseAltiumSchDoc(content)
    const sheet = doc.getRecordsByKind("31")[0]!
    const pin = doc.pins[0]!
    expect(pin.position).toEqual({ x: 187, y: 267 })
    expect(sheet.getNumber(`SIZE${pin.getNumber("NAME_CUSTOMFONTID")}`)).toBe(
      10,
    )
    expect(
      sheet.getNumber(`SIZE${pin.getNumber("DESIGNATOR_CUSTOMFONTID")}`),
    ).toBe(10)
    expect(
      sheet.getNumber(`SIZE${doc.netLabels[0]!.getNumber("FONTID")}`),
    ).toBe(12)
    expect(doc.wires.flatMap(getSchematicRecordPoints)).toContainEqual(
      pin.position!,
    )
    const junctions = doc.getRecordsByKind("29")
    expect(junctions).toHaveLength(1)
    expect(coordinate(junctions[0]!, "LOCATION.X")).toBe(167)
    expect(coordinate(junctions[0]!, "LOCATION.Y")).toBe(267)
    expect(junctions[0]!.getNumber("SIZE")).toBe(0)
    expect(junctions[0]!.getBoolean("LOCKED")).toBe(true)
    expect(junctions[0]!.getNumber("INDEXINSHEET")).toBe(
      doc.records.indexOf(junctions[0]!),
    )
    expect(sheet.getNumber("CUSTOMX")).toBe(667)
    for (const record of doc.records) {
      for (const field of record.fields) {
        if (
          /^(?:SIZE\d+|(?:LOCATION|CORNER)\.[XY]|[XY]\d+|RADIUS|PINLENGTH|WIDTH|HEIGHT|XSIZE|YSIZE)$/iu.test(
            field.key,
          )
        ) {
          expect(Number.isInteger(Number(field.value))).toBe(true)
        }
      }
    }
  }
  const binary = parseAltiumSchDoc(output.content)
  const port = binary.powerPorts[0]!
  expect(port.getNumber("ORIENTATION")).toBe(1)
  expect(port.getNumber("STYLE")).toBe(2)
  const graphics = binary.getObjectDefinitionGraphics(
    port.getCaseInsensitive("ObjectDefinitionId")!,
  )!
  expect(coordinate(graphics[0]!, "CORNER.X")).toBeCloseTo(100 / 3, 5)
  expect(coordinate(graphics[1]!, "LOCATION.Y")).toBeCloseTo(-50 / 3, 5)
  expect(graphics.every((r) => r.getNumber("LINEWIDTH") === 0)).toBe(true)
})

test("native scale rejects invalid values and unscaled external templates", () => {
  const schematicSheets = [
    {
      width: 10,
      height: 10,
      templateContent: new TextEncoder().encode(
        "|RECORD=31\r\n|RECORD=39|FILENAME=legacy.SchDot\r\n|RECORD=14|OWNERINDEX=1|LOCATION.X=5|LOCATION.Y=10|CORNER.X=15|CORNER.Y=20\r\n",
      ),
    },
  ]
  // Imported native templates keep their original grid unless a supported
  // explicit scale is selected; changing the new-export default cannot break them.
  expect(convert({ schematicSheets })).toEqual(
    convert({
      schematicSheets,
      schematicUnitsPerCircuitUnit: 20,
    }),
  )
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => convert({ schematicUnitsPerCircuitUnit: value })).toThrow(
      "positive finite",
    )
  }
  expect(() =>
    convert({
      schematicUnitsPerCircuitUnit: units,
      schematicSheets: [
        {
          width: 10,
          height: 10,
          templateContent: new TextEncoder().encode("|RECORD=31\r\n"),
        },
      ],
    }),
  ).toThrow("Custom schematic templates")
})

test("the TI supply keeps native junctions and component terminals at the default scale", async () => {
  const source = await Bun.file(
    new URL("assets/ti-tps61288-power-supply.circuit.json", import.meta.url),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(source, {
    projectName: "ti-tps61288-small-junctions",
  })
  converter.runUntilFinished()
  const output = converter.getOutput().schematics[0]!
  expect(output.content).toEqual(
    await Bun.file(
      new URL("assets/ti-tps61288-small-junctions.SchDoc", import.meta.url),
    ).bytes(),
  )
  const document = parseAltiumSchDoc(output.content)
  expect(document.pins).toHaveLength(145)
  expect(document.netLabels).toHaveLength(25)
  expect(document.powerPorts).toHaveLength(21)
  expect(document.getRecordsByKind("29")).toHaveLength(62)
  const sourcePorts = source.filter(
    (e: CircuitElement) =>
      e.type === "schematic_port" && e.schematic_component_id,
  )
  const pinPositions = document.pins.map((p) => p.position!)
  // The shared translation cancels: every terminal uses the source pitch,
  // with at most one unit of rounding error, rather than rescaling 20-unit output.
  const sourceOrigin = sourcePorts[0].center
  const nativeOrigin = pinPositions[0]!
  for (const [index, port] of sourcePorts.entries()) {
    expect(
      Math.abs(
        pinPositions[index]!.x -
          nativeOrigin.x -
          (port.center.x - sourceOrigin.x) * units,
      ),
    ).toBeLessThanOrEqual(1.00001)
    expect(
      Math.abs(
        pinPositions[index]!.y -
          nativeOrigin.y -
          (port.center.y - sourceOrigin.y) * units,
      ),
    ).toBeLessThanOrEqual(1.00001)
  }
})
