import { expect, test } from "bun:test"
import { type AltiumRecord, parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"

const coordinate = (r: AltiumRecord, key: string) =>
  (r.getNumber(key) ?? 0) + (r.getNumber(`${key}_FRAC`) ?? 0) / 100_000

test("scaled sheet entries use native FRAC1 units and keep No ERC markers aligned", () => {
  for (const placed of [false, true]) {
    const circuit: CircuitElement[] = [
      board(),
      {
        type: "schematic_sheet",
        schematic_sheet_id: "child",
        subcircuit_id: "sub",
        sheet_index: 0,
      },
      {
        type: "source_port",
        source_port_id: "unused",
        name: "UNUSED",
        do_not_connect: true,
      },
      {
        type: "schematic_port",
        schematic_sheet_id: "child",
        source_port_id: "unused",
        center: { x: 2, y: 0.37 },
        facing_direction: "right",
      },
      ...(placed
        ? [
            {
              type: "schematic_component",
              is_schematic_group: true,
              subcircuit_id: "sub",
              center: { x: 0, y: 0 },
              size: { width: 4, height: 2 },
            },
          ]
        : []),
    ]
    const converter = new CircuitJsonToAltiumConverter(circuit, {
      schematicUnitsPerCircuitUnit: 200 / 3,
    })
    converter.runUntilFinished()
    const output = converter.getOutput().schematics[0]!
    for (const content of [output.asciiContent, output.content]) {
      const doc = parseAltiumSchDoc(content)
      const symbol = doc.getRecordsByKind("15")[0]!
      const entry = doc
        .getOwnedRecords(symbol)
        .find((r) => r.recordKind === "16")!
      const noErc = doc.getRecordsByKind("22")[0]!
      expect(entry.getNumber("SIDE")).toBe(1)
      expect(entry.getNumber("DISTANCEFROMTOP_FRAC")).toBeUndefined()
      expect(entry.getNumber("DISTANCEFROMTOP_FRAC1")).toBeGreaterThan(0)
      const distance =
        entry.getNumber("DISTANCEFROMTOP")! * 10 +
        entry.getNumber("DISTANCEFROMTOP_FRAC1")! / 100_000
      expect(coordinate(noErc, "LOCATION.X")).toBeCloseTo(
        coordinate(symbol, "LOCATION.X") + coordinate(symbol, "XSIZE"),
        4,
      )
      expect(coordinate(noErc, "LOCATION.Y")).toBeCloseTo(
        coordinate(symbol, "LOCATION.Y") - distance,
        4,
      )
    }
  }
})
