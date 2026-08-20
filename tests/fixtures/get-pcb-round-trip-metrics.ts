import type { CircuitElement } from "../../lib/types"

const preservedPrimitiveTypes = [
  "source_net",
  "source_component",
  "source_group",
  "pcb_component",
  "source_port",
  "pcb_port",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "source_trace",
  "pcb_trace",
  "pcb_via",
  "pcb_copper_pour",
  "pcb_silkscreen_text",
  "pcb_courtyard_outline",
  "pcb_keepout",
  "pcb_fabrication_note_path",
  "pcb_fabrication_note_text",
  "pcb_fabrication_note_dimension",
  "pcb_note_path",
  "pcb_note_text",
  "pcb_note_dimension",
  "cad_component",
] as const

const geometryElementTypes = [
  "pcb_component",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "pcb_trace",
  "pcb_via",
  "pcb_silkscreen_text",
  "cad_component",
] as const

const rotationElementTypes = [
  "pcb_component",
  "pcb_smtpad",
  "pcb_plated_hole",
  "pcb_hole",
  "pcb_silkscreen_text",
  "cad_component",
] as const

type PreservedPrimitiveType = (typeof preservedPrimitiveTypes)[number]
type GeometryElementType = (typeof geometryElementTypes)[number]
type RotationElementType = (typeof rotationElementTypes)[number]

export type PreservedPrimitiveCounts = Record<PreservedPrimitiveType, number>

export type PcbRoundTripMetrics = {
  boardConstraintMismatchCount: number
  cadComponentMismatchCount: number
  geometryMaxDeltaMm: number
  rotationMismatchCount: number
  roundTripCounts: PreservedPrimitiveCounts
  roundTripSourceNetNames: string[]
  sourceCounts: PreservedPrimitiveCounts
  sourceNetNames: string[]
  sourcePrimitiveTotal: number
  silkscreenTextMismatchCount: number
  sourceGroupMembershipMismatchCount: number
}

const boardConstraintFieldNames = [
  "min_trace_width",
  "min_board_edge_clearance",
  "min_via_hole_edge_to_via_hole_edge_clearance",
  "min_plated_hole_drill_edge_to_drill_edge_clearance",
  "min_trace_to_pad_edge_clearance",
  "min_pad_edge_to_pad_edge_clearance",
  "min_same_net_trace_edge_to_trace_edge_clearance",
  "min_different_net_trace_edge_to_trace_edge_clearance",
  "min_via_edge_to_pad_edge_clearance",
  "min_via_hole_diameter",
  "min_via_pad_diameter",
] as const

function getSourceNetNames(circuitJson: CircuitElement[]): string[] {
  return circuitJson.flatMap((element) => {
    if (element.type !== "source_net" || typeof element.name !== "string") {
      return []
    }
    return [element.name]
  })
}

function countPreservedPrimitives(
  circuitJson: CircuitElement[],
): PreservedPrimitiveCounts {
  const counts = Object.fromEntries(
    preservedPrimitiveTypes.map((type) => [
      type,
      circuitJson.filter((element) => element.type === type).length,
    ]),
  )
  return counts as PreservedPrimitiveCounts
}

function getGeometryPoints(
  circuitJson: CircuitElement[],
  elementType: GeometryElementType,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  for (const element of circuitJson) {
    if (element.type !== elementType) continue
    if (elementType === "pcb_trace" && Array.isArray(element.route)) {
      for (const routePoint of element.route) {
        if (
          typeof routePoint === "object" &&
          routePoint !== null &&
          "x" in routePoint &&
          "y" in routePoint &&
          typeof routePoint.x === "number" &&
          typeof routePoint.y === "number"
        ) {
          points.push({ x: routePoint.x, y: routePoint.y })
        }
      }
      continue
    }
    if (
      elementType === "cad_component" &&
      typeof element.position === "object" &&
      element.position !== null &&
      "x" in element.position &&
      "y" in element.position &&
      typeof element.position.x === "number" &&
      typeof element.position.y === "number"
    ) {
      points.push({ x: element.position.x, y: element.position.y })
      continue
    }
    if (
      elementType === "pcb_component" &&
      typeof element.center === "object" &&
      element.center !== null &&
      "x" in element.center &&
      "y" in element.center &&
      typeof element.center.x === "number" &&
      typeof element.center.y === "number"
    ) {
      points.push({ x: element.center.x, y: element.center.y })
      continue
    }
    if (
      elementType === "pcb_silkscreen_text" &&
      typeof element.anchor_position === "object" &&
      element.anchor_position !== null &&
      "x" in element.anchor_position &&
      "y" in element.anchor_position &&
      typeof element.anchor_position.x === "number" &&
      typeof element.anchor_position.y === "number"
    ) {
      points.push({
        x: element.anchor_position.x,
        y: element.anchor_position.y,
      })
      continue
    }
    if (
      elementType !== "cad_component" &&
      elementType !== "pcb_component" &&
      elementType !== "pcb_trace" &&
      elementType !== "pcb_silkscreen_text" &&
      typeof element.x === "number" &&
      typeof element.y === "number"
    ) {
      points.push({ x: element.x, y: element.y })
    }
  }
  return points
}

function getBoardConstraintMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourceBoard = sourceCircuitJson.find(
    (element) => element.type === "pcb_board",
  )
  const roundTripBoard = roundTripCircuitJson.find(
    (element) => element.type === "pcb_board",
  )
  return boardConstraintFieldNames.reduce((mismatchCount, fieldName) => {
    const sourceValue = sourceBoard?.[fieldName]
    const roundTripValue = roundTripBoard?.[fieldName]
    if (sourceValue === undefined && roundTripValue === undefined) {
      return mismatchCount
    }
    if (
      typeof sourceValue !== "number" ||
      typeof roundTripValue !== "number" ||
      Math.abs(sourceValue - roundTripValue) > 0.0001
    ) {
      return mismatchCount + 1
    }
    return mismatchCount
  }, 0)
}

function getCadComponentMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourceCadComponents = sourceCircuitJson.filter(
    (element) => element.type === "cad_component",
  )
  const roundTripCadComponents = roundTripCircuitJson.filter(
    (element) => element.type === "cad_component",
  )
  if (sourceCadComponents.length !== roundTripCadComponents.length) {
    return Number.POSITIVE_INFINITY
  }
  return sourceCadComponents.reduce((mismatchCount, sourceCad, index) => {
    const roundTripCad = roundTripCadComponents[index]
    if (!roundTripCad) return mismatchCount + 1
    const fieldsMatch =
      point3ZMatches(sourceCad.position, roundTripCad.position) &&
      point3Matches(sourceCad.size, roundTripCad.size) &&
      sourceCad.layer === roundTripCad.layer &&
      getModelName(sourceCad) === getModelName(roundTripCad)
    return mismatchCount + (fieldsMatch ? 0 : 1)
  }, 0)
}

function point3ZMatches(first: unknown, second: unknown): boolean {
  const firstPoint = getPoint3(first)
  const secondPoint = getPoint3(second)
  if (!firstPoint || !secondPoint) return first === second
  return Math.abs(firstPoint.z - secondPoint.z) <= 0.0001
}

function point3Matches(first: unknown, second: unknown): boolean {
  const firstPoint = getPoint3(first)
  const secondPoint = getPoint3(second)
  if (!firstPoint || !secondPoint) return first === second
  return (
    Math.abs(firstPoint.x - secondPoint.x) <= 0.0001 &&
    Math.abs(firstPoint.y - secondPoint.y) <= 0.0001 &&
    Math.abs(firstPoint.z - secondPoint.z) <= 0.0001
  )
}

function getPoint3(
  input: unknown,
): { x: number; y: number; z: number } | undefined {
  if (
    typeof input !== "object" ||
    input === null ||
    !("x" in input) ||
    !("y" in input) ||
    !("z" in input) ||
    typeof input.x !== "number" ||
    typeof input.y !== "number" ||
    typeof input.z !== "number"
  ) {
    return undefined
  }
  return { x: input.x, y: input.y, z: input.z }
}

function getModelName(cadComponent: CircuitElement): string | undefined {
  if (
    typeof cadComponent.model_asset === "object" &&
    cadComponent.model_asset !== null &&
    "project_relative_path" in cadComponent.model_asset &&
    typeof cadComponent.model_asset.project_relative_path === "string"
  ) {
    return cadComponent.model_asset.project_relative_path
  }
  return typeof cadComponent.model_step_url === "string"
    ? cadComponent.model_step_url
    : undefined
}

function getSourceGroupMembershipMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourceMembership = getNormalizedSourceGroupMembership(sourceCircuitJson)
  const roundTripMembership =
    getNormalizedSourceGroupMembership(roundTripCircuitJson)
  return JSON.stringify(sourceMembership) ===
    JSON.stringify(roundTripMembership)
    ? 0
    : 1
}

function getNormalizedSourceGroupMembership(
  circuitJson: CircuitElement[],
): string[] {
  const groupNameById = new Map(
    circuitJson
      .filter((element) => element.type === "source_group")
      .flatMap((group) => {
        if (
          typeof group.source_group_id !== "string" ||
          typeof group.name !== "string"
        ) {
          return []
        }
        return [[group.source_group_id, group.name] as const]
      }),
  )
  const memberships: string[] = []
  for (const component of circuitJson.filter(
    (element) => element.type === "source_component",
  )) {
    if (
      typeof component.source_group_id !== "string" ||
      typeof component.name !== "string"
    ) {
      continue
    }
    const groupName = groupNameById.get(component.source_group_id)
    if (groupName) memberships.push(`component:${groupName}:${component.name}`)
  }
  for (const net of circuitJson.filter(
    (element) => element.type === "source_net",
  )) {
    if (!Array.isArray(net.member_source_group_ids)) continue
    for (const sourceGroupId of net.member_source_group_ids) {
      if (typeof sourceGroupId !== "string" || typeof net.name !== "string") {
        continue
      }
      const groupName = groupNameById.get(sourceGroupId)
      if (groupName) memberships.push(`net:${groupName}:${net.name}`)
    }
  }
  return memberships.sort()
}

function getSilkscreenTextMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  const sourceTexts = sourceCircuitJson.filter(
    (element) => element.type === "pcb_silkscreen_text",
  )
  const roundTripTexts = roundTripCircuitJson.filter(
    (element) => element.type === "pcb_silkscreen_text",
  )
  if (sourceTexts.length !== roundTripTexts.length) {
    return Number.POSITIVE_INFINITY
  }

  return sourceTexts.reduce((mismatchCount, sourceText, index) => {
    const roundTripText = roundTripTexts[index]
    if (!roundTripText) return mismatchCount + 1
    const matches =
      sourceText.text === roundTripText.text &&
      sourceText.anchor_alignment === roundTripText.anchor_alignment &&
      sourceText.is_mirrored === roundTripText.is_mirrored &&
      sourceText.layer === roundTripText.layer
    return mismatchCount + (matches ? 0 : 1)
  }, 0)
}

function getGeometryMaxDeltaMm(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  let maxDeltaMm = 0
  for (const elementType of geometryElementTypes) {
    const sourcePoints = getGeometryPoints(sourceCircuitJson, elementType)
    const roundTripPoints = getGeometryPoints(roundTripCircuitJson, elementType)
    const sourceAnchor = sourcePoints[0]
    const roundTripAnchor = roundTripPoints[0]
    if (sourcePoints.length !== roundTripPoints.length) {
      return Number.POSITIVE_INFINITY
    }
    if (!sourceAnchor || !roundTripAnchor) continue

    for (const [index, sourcePoint] of sourcePoints.entries()) {
      const roundTripPoint = roundTripPoints[index]
      if (!roundTripPoint) return Number.POSITIVE_INFINITY
      maxDeltaMm = Math.max(
        maxDeltaMm,
        Math.abs(
          sourcePoint.x -
            sourceAnchor.x -
            (roundTripPoint.x - roundTripAnchor.x),
        ),
        Math.abs(
          sourcePoint.y -
            sourceAnchor.y -
            (roundTripPoint.y - roundTripAnchor.y),
        ),
      )
    }
  }
  return maxDeltaMm
}

function getCcwRotationsDegrees(
  circuitJson: CircuitElement[],
  elementType: RotationElementType,
): number[] {
  return circuitJson
    .filter((element) => element.type === elementType)
    .flatMap((element) => {
      if (elementType === "cad_component") {
        const rotation = getPoint3(element.rotation)
        return rotation ? [rotation.z] : [0]
      }
      const ccwRotationDegrees = element.rotation ?? element.ccw_rotation ?? 0
      return typeof ccwRotationDegrees === "number" ? [ccwRotationDegrees] : []
    })
}

function getRotationMismatchCount(
  sourceCircuitJson: CircuitElement[],
  roundTripCircuitJson: CircuitElement[],
): number {
  let mismatchCount = 0
  for (const elementType of rotationElementTypes) {
    const sourceCcwRotationsDegrees = getCcwRotationsDegrees(
      sourceCircuitJson,
      elementType,
    )
    const roundTripCcwRotationsDegrees = getCcwRotationsDegrees(
      roundTripCircuitJson,
      elementType,
    )
    if (
      sourceCcwRotationsDegrees.length !== roundTripCcwRotationsDegrees.length
    ) {
      return Number.POSITIVE_INFINITY
    }
    mismatchCount += sourceCcwRotationsDegrees.reduce(
      (typeMismatchCount, ccwRotationDegrees, index) => {
        const roundTripCcwRotationDegrees =
          roundTripCcwRotationsDegrees[index] ?? 0
        return (
          typeMismatchCount +
          (getCircularRotationDeltaDegrees(
            ccwRotationDegrees,
            roundTripCcwRotationDegrees,
          ) <= 0.0001
            ? 0
            : 1)
        )
      },
      0,
    )
  }
  return mismatchCount
}

function getCircularRotationDeltaDegrees(
  firstCcwRotationDegrees: number,
  secondCcwRotationDegrees: number,
): number {
  const linearDeltaDegrees =
    Math.abs(firstCcwRotationDegrees - secondCcwRotationDegrees) % 360
  return Math.min(linearDeltaDegrees, 360 - linearDeltaDegrees)
}

export function getPcbRoundTripMetrics({
  roundTripCircuitJson,
  sourceCircuitJson,
}: {
  roundTripCircuitJson: CircuitElement[]
  sourceCircuitJson: CircuitElement[]
}): PcbRoundTripMetrics {
  const sourceCounts = countPreservedPrimitives(sourceCircuitJson)
  const roundTripCounts = countPreservedPrimitives(roundTripCircuitJson)

  return {
    boardConstraintMismatchCount: getBoardConstraintMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    cadComponentMismatchCount: getCadComponentMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    geometryMaxDeltaMm: getGeometryMaxDeltaMm(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    rotationMismatchCount: getRotationMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    roundTripCounts,
    roundTripSourceNetNames: getSourceNetNames(roundTripCircuitJson),
    sourceCounts,
    sourceNetNames: getSourceNetNames(sourceCircuitJson),
    sourcePrimitiveTotal: Object.values(sourceCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    silkscreenTextMismatchCount: getSilkscreenTextMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
    sourceGroupMembershipMismatchCount: getSourceGroupMembershipMismatchCount(
      sourceCircuitJson,
      roundTripCircuitJson,
    ),
  }
}
