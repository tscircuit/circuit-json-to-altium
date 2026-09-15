import { expect, test } from "bun:test"
import { getSchematicRecordPoints, serializeAltiumSheetToSvg } from "altiumts"
import { board, extractArchive, sourceComponent, sourcePort } from "./fixtures"

function getSchematicCoordinate(
  record: { getNumber(key: string): number | undefined },
  key: string,
): number {
  return (
    (record.getNumber(key) ?? 0) +
    (record.getNumber(`${key}_FRAC`) ?? 0) / 100_000
  )
}

for (const [orientation, facing] of ["right", "up", "left", "down"].entries()) {
  test(`matches the Circuit JSON inversion bubble on the ${facing} side`, async () => {
    const dx = [1, 0, -1, 0][orientation]!
    const dy = [0, 1, 0, -1][orientation]!
    const doc = (
      await extractArchive([
        board(),
        sourceComponent("part", "U1"),
        sourcePort({
          sourcePortId: "pin",
          sourceComponentId: "part",
          pinNumber: 5,
        }),
        {
          type: "schematic_component",
          schematic_component_id: "body",
          source_component_id: "part",
          center: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          is_box_with_pins: true,
        },
        {
          type: "schematic_port",
          schematic_port_id: "port",
          schematic_component_id: "body",
          source_port_id: "pin",
          center: { x: 1.5 * dx, y: 1.5 * dy },
          distance_from_component_edge: 0.5,
          facing_direction: facing,
          pin_number: 5,
          display_pin_label: "INVERTED",
          is_drawn_with_inversion_circle: true,
        },
      ])
    ).schematics[0]!
    const pin = doc.pins[0]!
    const bubble = doc.records.find((r) => r.recordKind === "8")!
    const radius = 0.06 * 20
    expect(getSchematicCoordinate(bubble, "RADIUS")).toBeCloseTo(radius)
    expect(getSchematicCoordinate(bubble, "SECONDARYRADIUS")).toBeCloseTo(
      radius,
    )
    expect(bubble.getBoolean("ISSOLID")).toBe(true)
    expect(bubble.getNumber("AREACOLOR")).toBe(0xffffff)
    expect(bubble.getNumber("LINEWIDTH")).toBe(0)
    expect(bubble.getNumber("OWNERINDEX")).toBe(pin.getNumber("OWNERINDEX"))
    expect(pin.getNumber("SYMBOL_OUTEREDGE")).toBeUndefined()
    expect(pin.getNumber("PINLENGTH")).toBe(0)
    const center = {
      x: getSchematicCoordinate(bubble, "LOCATION.X"),
      y: getSchematicCoordinate(bubble, "LOCATION.Y"),
    }
    const body = { x: center.x - dx * radius, y: center.y - dy * radius }
    expect(pin.position!.x).toBeCloseTo(body.x + dx * radius * 2)
    expect(pin.position!.y).toBeCloseTo(body.y + dy * radius * 2)
    const wire = getSchematicRecordPoints(doc.wires[0]!)
    expect(wire[0]).toEqual(pin.position!)
    expect(wire[1]!.x).toBeCloseTo(body.x + dx * 10)
    expect(wire[1]!.y).toBeCloseTo(body.y + dy * 10)
    // Moving the electrical terminal must not move either text anchor.
    expect(
      getSchematicCoordinate(pin, "NAME_CUSTOMPOSITION_MARGIN") + radius * 2,
    ).toBeCloseTo(-2)
    expect(
      getSchematicCoordinate(pin, "DESIGNATOR_CUSTOMPOSITION_MARGIN") +
        radius * 2,
    ).toBeCloseTo(3)
    const svg = serializeAltiumSheetToSvg(doc)
    expect(svg).toContain('rx="1.2" ry="1.2" fill="#ffffff"')
    expect(svg).not.toContain("altium-schematic-pin-inversion-symbol")
  })
}
