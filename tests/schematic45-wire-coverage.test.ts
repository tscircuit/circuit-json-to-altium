import { expect, test } from "bun:test"
import { getSchematicRoundTripMetrics } from "./fixtures/get-schematic-round-trip-metrics"
import { schematicWireCoverageMatches } from "./fixtures/schematic-wire-coverage"

function segment({ x1, x2, y = 0 }: { x1: number; x2: number; y?: number }) {
  return {
    from: { x: x1, y },
    to: { x: x2, y },
  }
}

test("wire coverage accepts coalescing but detects gaps and newly added wires", () => {
  const overlapping = [segment({ x1: 0, x2: 10 }), segment({ x1: 5, x2: 15 })]
  expect(
    schematicWireCoverageMatches({
      source: overlapping,
      output: [segment({ x1: 0, x2: 15 })],
    }),
  ).toBe(true)
  expect(
    schematicWireCoverageMatches({
      source: overlapping,
      output: [segment({ x1: 0, x2: 7 }), segment({ x1: 8, x2: 15 })],
    }),
  ).toBe(false)
  expect(
    schematicWireCoverageMatches({
      source: overlapping,
      output: [segment({ x1: 0, x2: 16 })],
    }),
  ).toBe(false)
  expect(
    schematicWireCoverageMatches({
      source: overlapping,
      output: [segment({ x1: 0, x2: 15, y: 1 })],
    }),
  ).toBe(false)
})

test("round-trip geometry still checks a sheet containing only traces", () => {
  const result = getSchematicRoundTripMetrics({
    sourceCircuitJson: [
      { type: "schematic_trace", edges: [segment({ x1: 0, x2: 10 })] },
    ],
    roundTripCircuitJson: [
      {
        type: "schematic_trace",
        edges: [segment({ x1: 0, x2: 4 }), segment({ x1: 5, x2: 10 })],
      },
    ],
  })
  expect(result.geometryMaxDeltaCircuitUnits).toBe(Number.POSITIVE_INFINITY)
})
