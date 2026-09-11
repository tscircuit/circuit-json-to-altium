import { expect, test } from "bun:test"
import { type AltiumSchDoc, AltiumSchNoErcRecord } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

const elements: CircuitElement[] = [
  board(),
  {
    ...sourcePort({
      pinNumber: 1,
      sourceComponentId: "source_component_1",
      sourcePortId: "source_port_1",
    }),
    do_not_connect: true,
  },
  sourceComponent("source_component_1", "U1"),
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    size: { width: 2, height: 2 },
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_1",
    schematic_component_id: "schematic_component_1",
    source_port_id: "source_port_1",
    center: { x: 2, y: 0 },
    distance_from_component_edge: 0.5,
    facing_direction: "right",
  },
]

test("writes do-not-connect source ports as native Altium records", async () => {
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const pinRecord = schematic.pins[0]
  if (!pinRecord?.position) {
    throw new Error("Expected a native Altium pin record")
  }
  const stem = schematic.wires.find(
    (wire) =>
      wire.getNumber("X1") === pinRecord.position!.x &&
      wire.getNumber("Y1") === pinRecord.position!.y,
  )!
  expect(stem).toBeDefined()
  expect(pinRecord.getNumber("PINLENGTH")).toBe(0)
  const noConnectRecord = schematic.getRecordsByKind("22")[0]
  if (!(noConnectRecord instanceof AltiumSchNoErcRecord)) {
    throw new Error("Expected a native Altium No ERC record")
  }

  expect({
    color: noConnectRecord.getNumber("COLOR"),
    isActive: noConnectRecord.getBoolean("ISACTIVE"),
    orientation: noConnectRecord.getNumber("ORIENTATION"),
    ownerPartId: noConnectRecord.getNumber("OWNERPARTID"),
    position: noConnectRecord.position,
    suppressAll: noConnectRecord.getBoolean("SUPPRESSALL"),
    symbol: noConnectRecord.getDecoded("SYMBOL"),
  }).toEqual({
    color: 255,
    isActive: true,
    orientation: 1,
    ownerPartId: -1,
    position: {
      x: stem.getNumber("X2")!,
      y: stem.getNumber("Y2")!,
    },
    suppressAll: true,
    symbol: "Thin Cross",
  })
  expect(schematic.getRecordsByKind("22")).toHaveLength(1)
  expectValidSchematic(schematic)
})
