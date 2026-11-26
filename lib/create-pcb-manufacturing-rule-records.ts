import { asString, byType, formatMil, MILLIMETERS_TO_MILS } from "./format"
import type { CircuitElement } from "./types"

// Native kinds/fields match the pinned NodeMCU and HERON reference files.
const ruleTypes = {
  Clearance: 0,
  Width: 2,
  RoutingVias: 11,
  HoleToHoleClearance: 52,
  BoardOutlineClearance: 63,
} as const
type RuleKind = keyof typeof ruleTypes
const traceScope = "IsTrack Or IsArc"

type ManufacturingRuleOptions = {
  kind: RuleKind
  name: string
  scope1: string
  scope2: string
  netScope: string
  fields: string[]
}

function addRule(
  { kind, name, scope1, scope2, netScope, fields }: ManufacturingRuleOptions,
  records: string[],
): void {
  records.push(
    [
      "|RECORD=Rule",
      `BINARYRECORDTYPE=${ruleTypes[kind]}`,
      `RULEKIND=${kind}`,
      `NAME=Tscircuit${name}`,
      "ENABLED=TRUE",
      "DEFINEDBYLOGICALDOCUMENT=FALSE",
      `PRIORITY=${records.length + 1000}`,
      `NETSCOPE=${netScope}`,
      "LAYERKIND=SameLayer",
      `SCOPE1EXPRESSION=${scope1}`,
      `SCOPE2EXPRESSION=${scope2}`,
      ...fields,
    ].join("|"),
  )
}

function getManufacturingConstraint(
  board: CircuitElement,
  field: string,
): number | undefined {
  const constraint = board[field]
  if (constraint === undefined) return undefined
  if (
    typeof constraint !== "number" ||
    !Number.isFinite(constraint) ||
    constraint < 0
  )
    throw new RangeError(`Invalid PCB manufacturing constraint: ${field}`)
  return constraint
}

function formatManufacturingMeasurement(millimeters: number): string {
  return formatMil(millimeters * MILLIMETERS_TO_MILS)
}

export function createPcbManufacturingRuleRecords(
  circuitJson: CircuitElement[],
): string[] {
  const board = byType(circuitJson, "pcb_board")[0]
  if (!board) return []
  const records: string[] = []
  const width = getManufacturingConstraint(board, "min_trace_width")
  if (width !== undefined)
    addRule(
      {
        kind: "Width",
        name: "MinTraceWidth",
        scope1: traceScope,
        scope2: "All",
        netScope: "AnyNet",
        fields: [`MINLIMIT=${formatManufacturingMeasurement(width)}`],
      },
      records,
    )
  const clearances: [string, string, string, string, string][] = [
    [
      "min_trace_to_pad_edge_clearance",
      "TraceToPadClearance",
      traceScope,
      "IsPad",
      "DifferentNets",
    ],
    [
      "min_pad_edge_to_pad_edge_clearance",
      "PadToPadClearance",
      "IsPad",
      "IsPad",
      "DifferentNets",
    ],
    [
      "min_same_net_trace_edge_to_trace_edge_clearance",
      "SameNetTraceClearance",
      traceScope,
      traceScope,
      "SameNetOnly",
    ],
    [
      "min_different_net_trace_edge_to_trace_edge_clearance",
      "DifferentNetTraceClearance",
      traceScope,
      traceScope,
      "DifferentNets",
    ],
    [
      "min_via_edge_to_pad_edge_clearance",
      "ViaToPadClearance",
      "IsVia",
      "IsPad",
      "DifferentNets",
    ],
  ]
  for (const [field, name, scope1, scope2, netScope] of clearances) {
    const gap = getManufacturingConstraint(board, field)
    if (gap !== undefined)
      addRule(
        {
          kind: "Clearance",
          name,
          scope1,
          scope2,
          netScope,
          fields: [`GAP=${formatManufacturingMeasurement(gap)}`],
        },
        records,
      )
  }
  for (const [field, name, scope] of [
    [
      "min_via_hole_edge_to_via_hole_edge_clearance",
      "ViaDrillClearance",
      "IsVia",
    ],
    [
      "min_plated_hole_drill_edge_to_drill_edge_clearance",
      "PlatedDrillClearance",
      "IsPad And (PadIsPlated = 'True')",
    ],
  ] as const) {
    const gap = getManufacturingConstraint(board, field)
    if (gap !== undefined)
      addRule(
        {
          kind: "HoleToHoleClearance",
          name,
          scope1: scope,
          scope2: scope,
          netScope: "AnyNet",
          fields: [`GAP=${formatManufacturingMeasurement(gap)}`],
        },
        records,
      )
  }
  const edge = getManufacturingConstraint(board, "min_board_edge_clearance")
  if (edge !== undefined)
    addRule(
      {
        kind: "BoardOutlineClearance",
        name: "BoardEdgeClearance",
        scope1: "All",
        scope2: "All",
        netScope: "AnyNet",
        fields: [
          `GAP=${formatManufacturingMeasurement(edge)}`,
          `GENERICCLEARANCE=${formatManufacturingMeasurement(edge)}`,
        ],
      },
      records,
    )
  const holeDiameter = getManufacturingConstraint(
    board,
    "min_via_hole_diameter",
  )
  const padDiameter = getManufacturingConstraint(board, "min_via_pad_diameter")
  if (holeDiameter !== undefined || padDiameter !== undefined)
    addRule(
      {
        kind: "RoutingVias",
        name: "MinViaSize",
        scope1: "IsVia",
        scope2: "All",
        netScope: "AnyNet",
        fields: [
          ...(holeDiameter === undefined
            ? []
            : [`MINHOLEWIDTH=${formatManufacturingMeasurement(holeDiameter)}`]),
          ...(padDiameter === undefined
            ? []
            : [`MINWIDTH=${formatManufacturingMeasurement(padDiameter)}`]),
        ],
      },
      records,
    )
  return records
}

export function getManufacturingRuleBinaryType(
  kind: unknown,
): number | undefined {
  return ruleTypes[asString(kind) as RuleKind]
}
