import { expect, test } from "bun:test"
import type { AltiumRuleRecord } from "altiumts"
import { board, extractArchive } from "./fixtures"

type ManufacturingRuleName = string | undefined

test("writes native rule types, pair scopes and minima without inventing constraints", async () => {
  const settings = {
    min_trace_width: 0.25,
    min_board_edge_clearance: 0.4,
    min_trace_to_pad_edge_clearance: 0.3,
    min_pad_edge_to_pad_edge_clearance: 0.35,
    min_same_net_trace_edge_to_trace_edge_clearance: 0,
    min_different_net_trace_edge_to_trace_edge_clearance: 0.2,
    min_via_edge_to_pad_edge_clearance: 0.15,
    min_via_hole_edge_to_via_hole_edge_clearance: 0.5,
    min_plated_hole_drill_edge_to_drill_edge_clearance: 0.6,
    min_via_hole_diameter: 0.3,
    min_via_pad_diameter: 0.65,
  }
  const { pcb } = await extractArchive([board(settings)])
  const rules = new Map<ManufacturingRuleName, AltiumRuleRecord>(
    pcb.rules.map((rule) => [rule.get("NAME"), rule]),
  )
  expect(rules.size).toBe(10)
  for (const [name, field, expected, type] of [
    ["MinTraceWidth", "MINLIMIT", 0.25, 2],
    ["TraceToPadClearance", "GAP", 0.3, 0],
    ["PadToPadClearance", "GAP", 0.35, 0],
    ["SameNetTraceClearance", "GAP", 0, 0],
    ["DifferentNetTraceClearance", "GAP", 0.2, 0],
    ["ViaToPadClearance", "GAP", 0.15, 0],
    ["ViaDrillClearance", "GAP", 0.5, 52],
    ["PlatedDrillClearance", "GAP", 0.6, 52],
    ["BoardEdgeClearance", "GAP", 0.4, 63],
    ["MinViaSize", "MINHOLEWIDTH", 0.3, 11],
  ] as const) {
    const rule = rules.get(`Tscircuit${name}`)!
    expect(rule.getNumber("BINARYRECORDTYPE")).toBe(type)
    expect(rule.getAltiumMeasurement(field)?.toMillimeters()).toBeCloseTo(
      expected,
      4,
    )
    expect(rule.enabled).toBe(true)
  }
  expect(rules.get("TscircuitSameNetTraceClearance")?.get("NETSCOPE")).toBe(
    "SameNetOnly",
  )
  expect(
    rules.get("TscircuitPlatedDrillClearance")?.get("SCOPE1EXPRESSION"),
  ).toBe("IsPad And (PadIsPlated = 'True')")
  expect(
    rules.get("TscircuitTraceToPadClearance")?.get("SCOPE2EXPRESSION"),
  ).toBe("IsPad")
  expect(
    rules
      .get("TscircuitMinViaSize")
      ?.getAltiumMeasurement("MINWIDTH")
      ?.toMillimeters(),
  ).toBeCloseTo(0.65, 4)
  expect((await extractArchive([board()])).pcb.rules).toHaveLength(0)
  await expect(
    extractArchive([board({ min_trace_width: -1 })]),
  ).rejects.toThrow("Invalid PCB manufacturing constraint")
})
