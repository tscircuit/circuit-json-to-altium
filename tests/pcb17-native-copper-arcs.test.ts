import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
} from "./fixtures"
import { convertAltiumPcbToCircuitJson } from "./fixtures/convert-altium-pcb-to-circuit-json"

const QUARTER_CIRCLE_BULGE = Math.SQRT2 - 1

test("round-trips curved copper routes as native Altium arcs", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "source_trace",
      source_trace_id: "source_trace_curved",
      connected_source_port_ids: [],
      name: "CURVED_SIGNAL",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_curved",
      source_trace_id: "source_trace_curved",
      route: [
        {
          route_type: "wire",
          layer: "top",
          x: -3,
          y: -3,
          bulge: QUARTER_CIRCLE_BULGE,
          width: 0.3,
        },
        {
          route_type: "wire",
          layer: "top",
          x: 0,
          y: 0,
          bulge: -QUARTER_CIRCLE_BULGE,
          width: 0.3,
        },
        {
          route_type: "wire",
          layer: "top",
          x: 3,
          y: 3,
          width: 0.3,
        },
      ],
    },
  ]

  const { pcb } = await extractArchive(elements)
  const arcs = pcb.getRecordsByKind("Arc")
  expect(arcs).toHaveLength(2)
  expect(pcb.getRecordsByKind("Track")).toHaveLength(0)
  expect(arcs.map((arc) => pcb.getNetForRecord(arc)?.name)).toEqual([
    "CURVED_SIGNAL",
    "CURVED_SIGNAL",
  ])
  expect(arcs.map((arc) => arc.getNumber("STARTANGLE"))).toEqual([270, 180])
  expect(arcs.map((arc) => arc.getNumber("ENDANGLE"))).toEqual([360, 90])
  expectValidPcb(pcb)

  const importedBulges = convertAltiumPcbToCircuitJson(pcb).flatMap(
    (element) => {
      if (element.type !== "pcb_trace" || !Array.isArray(element.route)) {
        return []
      }
      const firstRoutePoint = element.route[0]
      if (
        typeof firstRoutePoint !== "object" ||
        firstRoutePoint === null ||
        !("bulge" in firstRoutePoint) ||
        typeof firstRoutePoint.bulge !== "number"
      ) {
        return []
      }
      return [firstRoutePoint.bulge]
    },
  )
  expect(importedBulges).toHaveLength(2)
  expect(importedBulges[0]).toBeCloseTo(QUARTER_CIRCLE_BULGE, 8)
  expect(importedBulges[1]).toBeCloseTo(-QUARTER_CIRCLE_BULGE, 8)

  await expect(serializeAltiumPcbToSvg(pcb)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
