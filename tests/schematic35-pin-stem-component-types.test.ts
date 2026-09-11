import { expect, test } from "bun:test"
import { any_source_component } from "circuit-json"
import {
  board,
  type CircuitElement,
  extractArchive,
  sourceComponent,
  sourcePort,
} from "./fixtures"

// Derive coverage from Circuit JSON so newly added component types are checked
// automatically, including types absent from the real-circuit fixtures.
const componentFtypes = any_source_component.options.flatMap((schema) =>
  schema.shape.type.value === "source_component" && "ftype" in schema.shape
    ? [schema.shape.ftype.value]
    : [],
)

test.each([undefined, ...componentFtypes])(
  "exports connected hairline pin stems for ftype %s and preserves clock/inversion edges",
  async (ftype) => {
    const elements: CircuitElement[] = [
      board(),
      { ...sourceComponent("part", "U1"), ...(ftype ? { ftype } : {}) },
      {
        type: "schematic_component",
        schematic_component_id: "body",
        source_component_id: "part",
        center: { x: 0, y: 0 },
        size: { width: 2, height: 2 },
      },
    ]
    for (const [i, facing] of ["right", "up", "left", "down"].entries()) {
      const dx = [1, 0, -1, 0][i]!
      const dy = [0, 1, 0, -1][i]!
      elements.push(
        sourcePort({
          sourcePortId: `pin${i}`,
          sourceComponentId: "part",
          pinNumber: i + 1,
        }),
        {
          type: "schematic_port",
          schematic_port_id: `port${i}`,
          schematic_component_id: "body",
          source_port_id: `pin${i}`,
          center: { x: 1.5 * dx, y: 1.5 * dy },
          distance_from_component_edge: 0.5,
          facing_direction: facing,
          display_pin_label: `SIGNAL${i}`,
          has_input_arrow: i === 1 || i === 3,
          has_output_arrow: i === 2 || i === 3,
          is_drawn_with_inversion_circle: i === 3,
        },
      )
    }
    const doc = (await extractArchive(elements)).schematics[0]!
    expect(doc.pins).toHaveLength(4)
    expect(doc.wires).toHaveLength(4)
    for (const [i, pin] of doc.pins.entries()) {
      const nativeLength = i === 3 ? 5 : 0
      expect(pin.getNumber("PINLENGTH")).toBe(nativeLength)
      expect(pin.getNumber("ELECTRICAL")).toBe([4, 0, 2, 1][i])
      expect(pin.getNumber("SYMBOL_INNEREDGE")).toBe(
        i === 1 || i === 3 ? 3 : undefined,
      )
      expect(pin.getNumber("SYMBOL_OUTEREDGE")).toBe(i === 3 ? 1 : undefined)
      const dx = [1, 0, -1, 0][i]!
      const dy = [0, 1, 0, -1][i]!
      const start = {
        x: pin.position!.x + dx * nativeLength,
        y: pin.position!.y + dy * nativeLength,
      }
      const wire = doc.wires[i]!
      expect([wire.getNumber("X1"), wire.getNumber("Y1")]).toEqual([
        start.x,
        start.y,
      ])
      expect([wire.getNumber("X2"), wire.getNumber("Y2")]).toEqual([
        pin.position!.x + dx * 10,
        pin.position!.y + dy * 10,
      ])
      expect(wire.getNumber("LINEWIDTH")).toBe(0)
    }
  },
)
