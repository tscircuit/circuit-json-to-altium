import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"

test("serializes Circuit JSON manufacturing constraints as native rules", () => {
  const elements: CircuitElement[] = [
    board({
      min_trace_width: 0.15,
      min_board_edge_clearance: 0.25,
      min_via_hole_edge_to_via_hole_edge_clearance: 0.3,
      min_plated_hole_drill_edge_to_drill_edge_clearance: 0.35,
      min_trace_to_pad_edge_clearance: 0.2,
      min_pad_edge_to_pad_edge_clearance: 0.22,
      min_same_net_trace_edge_to_trace_edge_clearance: 0.18,
      min_different_net_trace_edge_to_trace_edge_clearance: 0.24,
      min_via_edge_to_pad_edge_clearance: 0.28,
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    }),
    {
      type: "source_net",
      source_net_id: "source_net_vcc",
      name: "VCC",
      member_source_group_ids: [],
      trace_width: 0.4,
    },
  ]
  const converter = new CircuitJsonToAltiumConverter(elements)
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const rulesByName = new Map(document.rules.map((rule) => [rule.name, rule]))

  expect(document.rules).toHaveLength(11)
  expect(rulesByName.get("Minimum Trace Width")?.widthConstraint).toEqual({
    minimumMils: 5.9055,
  })
  expect(rulesByName.get("Minimum Via Dimensions")).toMatchObject({
    viaDiameterConstraint: { minimumMils: 23.622 },
    viaHoleConstraint: { minimumMils: 11.811 },
  })
  expect(rulesByName.get("Board Outline Clearance")).toMatchObject({
    clearanceMils: 9.8425,
    ruleKind: "BoardOutlineClearance",
  })
  expect(rulesByName.get("Via Hole Clearance")).toMatchObject({
    clearanceMils: 11.811,
    scope1Expression: "IsVia",
    scope2Expression: "IsVia",
  })
  expect(rulesByName.get("Plated Hole Clearance")).toMatchObject({
    clearanceMils: 13.7795,
    scope1Expression: "IsPad",
    scope2Expression: "IsPad",
  })
  expect(rulesByName.get("Trace to Pad Clearance")).toMatchObject({
    clearanceMils: 7.874,
    scope1Expression: "IsTrack",
    scope2Expression: "IsPad",
  })
  expect(rulesByName.get("Same Net Trace Clearance")?.get("NETSCOPE")).toBe(
    "SameNet",
  )
  expect(
    rulesByName.get("Different Net Trace Clearance")?.get("NETSCOPE"),
  ).toBe("DifferentNets")
  expect(rulesByName.get("VCC Trace Width")).toMatchObject({
    scope1Expression: "InNet('VCC')",
    widthConstraint: { preferredMils: 15.748 },
  })
})
