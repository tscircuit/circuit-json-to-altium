import { expect, test } from "bun:test"
import { getSchematicRecordPoints, parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { asPoint, asString } from "../lib/format"
import { getSchematicTransform } from "../lib/get-schematic-transform"
import type { CircuitElement } from "../lib/types"
import { expectValidSchematic } from "./fixtures"
import { schematicWireCoverageMatches } from "./fixtures/schematic-wire-coverage"

test("automotive chip, built-in and custom-symbol pins connect at Circuit JSON port centers", async () => {
  const circuit: CircuitElement[] = await Bun.file(
    new URL(
      "./assets/generated-system-automotive-mirror.circuit.json",
      import.meta.url,
    ),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuit, {
    projectName: "automotive-mirror-system",
  })
  converter.runUntilFinished()
  const sheets = circuit.filter((e) => e.type === "schematic_sheet")
  const checkedNames = new Set<string>()
  let checkedPins = 0
  for (const [index, sheet] of sheets.entries()) {
    const elements = circuit.filter(
      (e) =>
        e.type?.startsWith("schematic_") &&
        e.type !== "schematic_sheet" &&
        e.schematic_sheet_id === sheet.schematic_sheet_id,
    )
    const toAltium =
      getSchematicTransform(elements).circuitToAltiumSchematicPoint
    const file = converter
      .getOutput()
      .schematics.find(
        (s) =>
          s.filename ===
          `automotive-mirror-system-${String(index + 1).padStart(2, "0")}.SchDoc`,
      )!
    const doc = parseAltiumSchDoc(file.content)
    expectValidSchematic(doc)
    const ports = elements
      .filter((e) => e.type === "schematic_component")
      .flatMap((component) => {
        const source = circuit.find(
          (e) =>
            e.type === "source_component" &&
            e.source_component_id === component.source_component_id,
        )
        checkedNames.add(asString(source?.name))
        return elements.filter(
          (e) =>
            e.type === "schematic_port" &&
            e.schematic_component_id === component.schematic_component_id,
        )
      })
    expect(doc.pins).toHaveLength(ports.length)
    for (const [pinIndex, pin] of doc.pins.entries()) {
      expect(pin.getNumber("PINLENGTH")).toBe(0)
      expect(pin.position).toEqual(toAltium(asPoint(ports[pinIndex]!.center)!))
      checkedPins++
    }
    // Overlap cleanup can change vertices and record counts, but must retain
    // the entire source wire coverage. Net-label leaders are tested separately.
    const sourceEdges = elements
      .filter((e) => e.type === "schematic_trace")
      .flatMap(
        (e) =>
          e.edges as {
            from: { x: number; y: number }
            to: { x: number; y: number }
          }[],
      )
    const sourceSegments = sourceEdges.map((edge) => ({
      from: toAltium(edge.from),
      to: toAltium(edge.to),
    }))
    const outputSegments = doc.wires
      .filter(
        (wire) => !wire.getCaseInsensitive("UNIQUEID")?.startsWith("CJNW"),
      )
      .map((wire) => {
        const [from, to] = getSchematicRecordPoints(wire)
        return { from: from!, to: to! }
      })
    expect(
      schematicWireCoverageMatches({
        source: sourceSegments,
        output: outputSegments,
      }),
    ).toBe(true)
  }
  expect(checkedPins).toBeGreaterThan(100)
  for (const name of ["U6", "R21", "L7"])
    expect(checkedNames.has(name)).toBe(true)
})
