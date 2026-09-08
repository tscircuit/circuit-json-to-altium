import { expect, test } from "bun:test"
import { serializeAltiumSheetToSvg } from "altiumts"
import { board, extractArchive, sourceComponent, sourcePort } from "./fixtures"

async function schematic(
  ftype: string,
  attributes: Record<string, unknown> = {},
) {
  const { schematics } = await extractArchive([
    board(),
    { ...sourceComponent("c", "C1"), ftype },
    {
      ...sourcePort({
        sourcePortId: "p",
        sourceComponentId: "c",
        pinNumber: 1,
      }),
      ...attributes,
    },
    {
      type: "schematic_component",
      schematic_component_id: "sc",
      source_component_id: "c",
      center: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "sp",
      schematic_component_id: "sc",
      source_port_id: "p",
      center: { x: -1.5, y: 0 },
      facing_direction: "left",
      distance_from_component_edge: 0.5,
      has_input_arrow: true,
    },
  ])
  return schematics[0]!
}

test("passive terminals retain their electrical type instead of defaulting to input", async () => {
  for (const ftype of [
    "simple_resistor",
    "simple_capacitor",
    "simple_inductor",
    "simple_pin_header",
  ]) {
    const doc = await schematic(ftype)
    expect(doc.getRecordsByKind("2")[0]?.getNumber("ELECTRICAL")).toBe(4)
    expect(serializeAltiumSheetToSvg(doc)).not.toContain(
      "altium-schematic-pin-electrical-symbol",
    )
  }
})

test("declared power/ground pins use power type while unknown signals default to passive", async () => {
  for (const key of [
    "provides_power",
    "requires_power",
    "provides_ground",
    "requires_ground",
  ]) {
    const doc = await schematic("simple_chip", { [key]: true })
    expect(doc.getRecordsByKind("2")[0]?.getNumber("ELECTRICAL")).toBe(7)
    expect(serializeAltiumSheetToSvg(doc)).not.toContain(
      "altium-schematic-pin-electrical-symbol",
    )
  }
  const unknown = await schematic("simple_chip")
  const pin = unknown.getRecordsByKind("2")[0]!
  expect(pin.getNumber("ELECTRICAL")).toBe(4)
  expect(serializeAltiumSheetToSvg(unknown)).not.toContain(
    'data-electrical="0"',
  )
})
