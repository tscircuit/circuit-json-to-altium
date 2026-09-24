import { expect, test } from "bun:test"
import { getSchematicRoundTripMetrics } from "./fixtures/get-schematic-round-trip-metrics"
import { schematicWireCoverageMatches } from "./fixtures/schematic-wire-coverage"

const segment = (x1: number, x2: number, y = 0) => ({
  from: { x: x1, y },
  to: { x: x2, y },
})

test("wire coverage accepts coalescing but detects gaps and newly added wires", () => {
  const overlapping = [segment(0, 10), segment(5, 15)]
  expect(schematicWireCoverageMatches(overlapping, [segment(0, 15)])).toBe(true)
  expect(
    schematicWireCoverageMatches(overlapping, [segment(0, 7), segment(8, 15)]),
  ).toBe(false)
  expect(schematicWireCoverageMatches(overlapping, [segment(0, 16)])).toBe(
    false,
  )
  expect(schematicWireCoverageMatches(overlapping, [segment(0, 15, 1)])).toBe(
    false,
  )
})

test("round-trip geometry still checks a sheet containing only traces", () => {
  const result = getSchematicRoundTripMetrics({
    sourceCircuitJson: [{ type: "schematic_trace", edges: [segment(0, 10)] }],
    roundTripCircuitJson: [
      { type: "schematic_trace", edges: [segment(0, 4), segment(5, 10)] },
    ],
  })
  expect(result.geometryMaxDeltaCircuitUnits).toBe(Number.POSITIVE_INFINITY)
})
