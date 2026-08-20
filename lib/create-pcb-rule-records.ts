import {
  asNumber,
  asString,
  byType,
  formatMil,
  MILLIMETERS_TO_MILS,
  sanitizeField,
} from "./format"
import type { CircuitElement } from "./types"

type AltiumRuleKind =
  | "BoardOutlineClearance"
  | "Clearance"
  | "HoleToHoleClearance"
  | "RoutingVias"
  | "Width"

type CreateRuleRecordOptions = {
  binaryRecordType: number
  constraintFields: string[]
  name: string
  netScope?: "AnyNet" | "DifferentNets" | "SameNet"
  ruleIndex: number
  ruleKind: AltiumRuleKind
  scope1Expression?: string
  scope2Expression?: string
}

export function createPcbRuleRecords(circuitJson: CircuitElement[]): string[] {
  const board = byType(circuitJson, "pcb_board")[0]
  if (!board) return []
  const records: string[] = []

  appendMinimumRule({
    board,
    fieldName: "min_trace_width",
    records,
    createRecord: (minimumMm, ruleIndex) =>
      createRuleRecord({
        binaryRecordType: 2,
        constraintFields: [`MINLIMIT=${formatLengthMm(minimumMm)}`],
        name: "Minimum Trace Width",
        ruleIndex,
        ruleKind: "Width",
      }),
  })
  const minimumViaPadDiameterMm = getPositiveLengthMm(
    board,
    "min_via_pad_diameter",
  )
  const minimumViaHoleDiameterMm = getPositiveLengthMm(
    board,
    "min_via_hole_diameter",
  )
  if (
    minimumViaPadDiameterMm !== undefined ||
    minimumViaHoleDiameterMm !== undefined
  ) {
    records.push(
      createRuleRecord({
        binaryRecordType: 11,
        constraintFields: [
          ...(minimumViaPadDiameterMm === undefined
            ? []
            : [`MINWIDTH=${formatLengthMm(minimumViaPadDiameterMm)}`]),
          ...(minimumViaHoleDiameterMm === undefined
            ? []
            : [`MINHOLEWIDTH=${formatLengthMm(minimumViaHoleDiameterMm)}`]),
          "VIASTYLE=Through Hole",
        ],
        name: "Minimum Via Dimensions",
        ruleIndex: records.length,
        ruleKind: "RoutingVias",
      }),
    )
  }
  appendMinimumRule({
    board,
    fieldName: "min_board_edge_clearance",
    records,
    createRecord: (minimumMm, ruleIndex) =>
      createRuleRecord({
        binaryRecordType: 63,
        constraintFields: [
          `GAP=${formatLengthMm(minimumMm)}`,
          `GENERICCLEARANCE=${formatLengthMm(minimumMm)}`,
        ],
        name: "Board Outline Clearance",
        netScope: "DifferentNets",
        ruleIndex,
        ruleKind: "BoardOutlineClearance",
      }),
  })
  appendHoleClearanceRule({
    board,
    fieldName: "min_via_hole_edge_to_via_hole_edge_clearance",
    name: "Via Hole Clearance",
    records,
    scopeExpression: "IsVia",
  })
  appendHoleClearanceRule({
    board,
    fieldName: "min_plated_hole_drill_edge_to_drill_edge_clearance",
    name: "Plated Hole Clearance",
    records,
    scopeExpression: "IsPad",
  })
  appendClearanceRule({
    board,
    fieldName: "min_trace_to_pad_edge_clearance",
    name: "Trace to Pad Clearance",
    records,
    scope1Expression: "IsTrack",
    scope2Expression: "IsPad",
  })
  appendClearanceRule({
    board,
    fieldName: "min_pad_edge_to_pad_edge_clearance",
    name: "Pad to Pad Clearance",
    records,
    scope1Expression: "IsPad",
    scope2Expression: "IsPad",
  })
  appendClearanceRule({
    board,
    fieldName: "min_same_net_trace_edge_to_trace_edge_clearance",
    name: "Same Net Trace Clearance",
    netScope: "SameNet",
    records,
    scope1Expression: "IsTrack",
    scope2Expression: "IsTrack",
  })
  appendClearanceRule({
    board,
    fieldName: "min_different_net_trace_edge_to_trace_edge_clearance",
    name: "Different Net Trace Clearance",
    netScope: "DifferentNets",
    records,
    scope1Expression: "IsTrack",
    scope2Expression: "IsTrack",
  })
  appendClearanceRule({
    board,
    fieldName: "min_via_edge_to_pad_edge_clearance",
    name: "Via to Pad Clearance",
    records,
    scope1Expression: "IsVia",
    scope2Expression: "IsPad",
  })

  for (const sourceNet of byType(circuitJson, "source_net")) {
    const traceWidthMm = getPositiveLengthMm(sourceNet, "trace_width")
    const netName = asString(sourceNet.name)
    if (traceWidthMm === undefined || !netName) continue
    records.push(
      createRuleRecord({
        binaryRecordType: 2,
        constraintFields: [`PREFEREDWIDTH=${formatLengthMm(traceWidthMm)}`],
        name: `${netName} Trace Width`,
        ruleIndex: records.length,
        ruleKind: "Width",
        scope1Expression: `InNet('${escapeAltiumQueryString(netName)}')`,
      }),
    )
  }
  return records
}

function appendMinimumRule({
  board,
  createRecord,
  fieldName,
  records,
}: {
  board: CircuitElement
  createRecord: (minimumMm: number, ruleIndex: number) => string
  fieldName: string
  records: string[]
}): void {
  const minimumMm = getPositiveLengthMm(board, fieldName)
  if (minimumMm === undefined) return
  records.push(createRecord(minimumMm, records.length))
}

function appendHoleClearanceRule({
  board,
  fieldName,
  name,
  records,
  scopeExpression,
}: {
  board: CircuitElement
  fieldName: string
  name: string
  records: string[]
  scopeExpression: "IsPad" | "IsVia"
}): void {
  const minimumMm = getPositiveLengthMm(board, fieldName)
  if (minimumMm === undefined) return
  records.push(
    createRuleRecord({
      binaryRecordType: 52,
      constraintFields: [
        `GAP=${formatLengthMm(minimumMm)}`,
        "ALLOWSTACKEDMICROVIAS=TRUE",
      ],
      name,
      ruleIndex: records.length,
      ruleKind: "HoleToHoleClearance",
      scope1Expression: scopeExpression,
      scope2Expression: scopeExpression,
    }),
  )
}

function appendClearanceRule({
  board,
  fieldName,
  name,
  netScope = "AnyNet",
  records,
  scope1Expression,
  scope2Expression,
}: {
  board: CircuitElement
  fieldName: string
  name: string
  netScope?: "AnyNet" | "DifferentNets" | "SameNet"
  records: string[]
  scope1Expression: string
  scope2Expression: string
}): void {
  const minimumMm = getPositiveLengthMm(board, fieldName)
  if (minimumMm === undefined) return
  records.push(
    createRuleRecord({
      binaryRecordType: 0,
      constraintFields: [
        `GAP=${formatLengthMm(minimumMm)}`,
        `GENERICCLEARANCE=${formatLengthMm(minimumMm)}`,
      ],
      name,
      netScope,
      ruleIndex: records.length,
      ruleKind: "Clearance",
      scope1Expression,
      scope2Expression,
    }),
  )
}

function createRuleRecord({
  binaryRecordType,
  constraintFields,
  name,
  netScope = "AnyNet",
  ruleIndex,
  ruleKind,
  scope1Expression = "All",
  scope2Expression = "All",
}: CreateRuleRecordOptions): string {
  return [
    "|RECORD=Rule",
    `BINARYRECORDTYPE=${binaryRecordType}`,
    "SELECTION=FALSE",
    "LAYER=TOP",
    "LOCKED=FALSE",
    "POLYGONOUTLINE=FALSE",
    "USERROUTED=TRUE",
    "KEEPOUT=FALSE",
    "UNIONINDEX=0",
    `RULEKIND=${ruleKind}`,
    `NETSCOPE=${netScope}`,
    "LAYERKIND=SameLayer",
    `SCOPE1EXPRESSION=${sanitizeField(scope1Expression)}`,
    `SCOPE2EXPRESSION=${sanitizeField(scope2Expression)}`,
    `NAME=${sanitizeField(name)}`,
    "ENABLED=TRUE",
    `PRIORITY=${ruleIndex + 1}`,
    `UNIQUEID=TSC${String(ruleIndex + 1).padStart(5, "0")}`,
    "DEFINEDBYLOGICALDOCUMENT=FALSE",
    ...constraintFields,
  ].join("|")
}

function getPositiveLengthMm(
  element: CircuitElement,
  fieldName: string,
): number | undefined {
  const lengthMm = asNumber(element[fieldName], Number.NaN)
  return lengthMm > 0 ? lengthMm : undefined
}

function formatLengthMm(lengthMm: number): string {
  return formatMil(lengthMm * MILLIMETERS_TO_MILS)
}

function escapeAltiumQueryString(altiumQueryString: string): string {
  return altiumQueryString.replaceAll("'", "''")
}
