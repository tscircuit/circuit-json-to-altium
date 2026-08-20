import { type AltiumPcbDocument, AltiumRuleRecord } from "altiumts"
import type { PcbNetName } from "../../lib/types"

const MILLIMETERS_PER_MIL = 0.0254

type PcbBoardConstraintFields = Partial<
  Record<
    | "min_board_edge_clearance"
    | "min_different_net_trace_edge_to_trace_edge_clearance"
    | "min_pad_edge_to_pad_edge_clearance"
    | "min_plated_hole_drill_edge_to_drill_edge_clearance"
    | "min_same_net_trace_edge_to_trace_edge_clearance"
    | "min_trace_to_pad_edge_clearance"
    | "min_trace_width"
    | "min_via_edge_to_pad_edge_clearance"
    | "min_via_hole_diameter"
    | "min_via_hole_edge_to_via_hole_edge_clearance"
    | "min_via_pad_diameter",
    number
  >
>

export type AltiumPcbRuleConstraints = {
  boardFields: PcbBoardConstraintFields
  traceWidthMmByNetName: Map<PcbNetName, number>
}

export function getAltiumPcbRuleConstraints(
  document: AltiumPcbDocument,
): AltiumPcbRuleConstraints {
  const boardFields: PcbBoardConstraintFields = {}
  const traceWidthMmByNetName = new Map<PcbNetName, number>()
  for (const rule of document.getRecordsByKind("Rule")) {
    if (!(rule instanceof AltiumRuleRecord)) continue
    if (rule.enabled === false) continue
    appendWidthConstraint({ boardFields, rule, traceWidthMmByNetName })
    appendViaConstraint({ boardFields, rule })
    appendBoardOutlineConstraint({ boardFields, rule })
    appendHoleConstraint({ boardFields, rule })
    appendClearanceConstraint({ boardFields, rule })
  }
  return { boardFields, traceWidthMmByNetName }
}

function appendWidthConstraint({
  boardFields,
  rule,
  traceWidthMmByNetName,
}: {
  boardFields: PcbBoardConstraintFields
  rule: AltiumRuleRecord
  traceWidthMmByNetName: Map<PcbNetName, number>
}): void {
  if (rule.ruleKind?.toUpperCase() !== "WIDTH") return
  const scope = rule.scope1Expression ?? "All"
  const netName = /^InNet\('((?:''|[^'])+)'\)$/iu
    .exec(scope)?.[1]
    ?.replaceAll("''", "'")
  const width = rule.widthConstraint
  if (netName && width?.preferredMils !== undefined) {
    traceWidthMmByNetName.set(
      netName,
      width.preferredMils * MILLIMETERS_PER_MIL,
    )
  } else if (
    scope.toUpperCase() === "ALL" &&
    width?.minimumMils !== undefined
  ) {
    boardFields.min_trace_width = width.minimumMils * MILLIMETERS_PER_MIL
  }
}

function appendViaConstraint({
  boardFields,
  rule,
}: {
  boardFields: PcbBoardConstraintFields
  rule: AltiumRuleRecord
}): void {
  if (rule.ruleKind?.toUpperCase() !== "ROUTINGVIAS") return
  const minimumPadMils = rule.viaDiameterConstraint?.minimumMils
  const minimumHoleMils = rule.viaHoleConstraint?.minimumMils
  if (minimumPadMils !== undefined) {
    boardFields.min_via_pad_diameter = minimumPadMils * MILLIMETERS_PER_MIL
  }
  if (minimumHoleMils !== undefined) {
    boardFields.min_via_hole_diameter = minimumHoleMils * MILLIMETERS_PER_MIL
  }
}

function appendBoardOutlineConstraint({
  boardFields,
  rule,
}: {
  boardFields: PcbBoardConstraintFields
  rule: AltiumRuleRecord
}): void {
  if (
    rule.ruleKind?.toUpperCase() !== "BOARDOUTLINECLEARANCE" ||
    (rule.scope1Expression ?? "All").toUpperCase() !== "ALL"
  ) {
    return
  }
  if (rule.clearanceMils !== undefined) {
    boardFields.min_board_edge_clearance =
      rule.clearanceMils * MILLIMETERS_PER_MIL
  }
}

function appendHoleConstraint({
  boardFields,
  rule,
}: {
  boardFields: PcbBoardConstraintFields
  rule: AltiumRuleRecord
}): void {
  if (
    rule.ruleKind?.toUpperCase() !== "HOLETOHOLECLEARANCE" ||
    rule.clearanceMils === undefined
  ) {
    return
  }
  const clearanceMm = rule.clearanceMils * MILLIMETERS_PER_MIL
  const scope = (rule.scope1Expression ?? "All").toUpperCase()
  if (scope === "ISVIA" || scope === "ALL") {
    boardFields.min_via_hole_edge_to_via_hole_edge_clearance = clearanceMm
  }
  if (scope === "ISPAD" || scope === "ALL") {
    boardFields.min_plated_hole_drill_edge_to_drill_edge_clearance = clearanceMm
  }
}

function appendClearanceConstraint({
  boardFields,
  rule,
}: {
  boardFields: PcbBoardConstraintFields
  rule: AltiumRuleRecord
}): void {
  if (
    rule.ruleKind?.toUpperCase() !== "CLEARANCE" ||
    rule.clearanceMils === undefined
  ) {
    return
  }
  const clearanceMm = rule.clearanceMils * MILLIMETERS_PER_MIL
  const firstScope = (rule.scope1Expression ?? "All").toUpperCase()
  const secondScope = (rule.scope2Expression ?? "All").toUpperCase()
  const netScope = rule.getDecoded("NETSCOPE")?.toUpperCase()
  const scopes = new Set([firstScope, secondScope])
  if (scopes.has("ISTRACK") && scopes.has("ISPAD")) {
    boardFields.min_trace_to_pad_edge_clearance = clearanceMm
  } else if (firstScope === "ISPAD" && secondScope === "ISPAD") {
    boardFields.min_pad_edge_to_pad_edge_clearance = clearanceMm
  } else if (firstScope === "ISTRACK" && secondScope === "ISTRACK") {
    const fieldName =
      netScope === "SAMENET"
        ? "min_same_net_trace_edge_to_trace_edge_clearance"
        : "min_different_net_trace_edge_to_trace_edge_clearance"
    boardFields[fieldName] = clearanceMm
  } else if (scopes.has("ISVIA") && scopes.has("ISPAD")) {
    boardFields.min_via_edge_to_pad_edge_clearance = clearanceMm
  } else if (firstScope === "ALL" && secondScope === "ALL") {
    boardFields.min_trace_to_pad_edge_clearance = clearanceMm
    boardFields.min_pad_edge_to_pad_edge_clearance = clearanceMm
    boardFields.min_different_net_trace_edge_to_trace_edge_clearance =
      clearanceMm
    boardFields.min_via_edge_to_pad_edge_clearance = clearanceMm
  }
}
