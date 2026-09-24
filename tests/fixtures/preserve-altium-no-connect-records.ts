import type { AltiumSchDoc } from "altiumts"
import { asPoint, asString } from "../../lib/format"
import type { CircuitElement, Point, SourcePortId } from "../../lib/types"
import {
  getRecordLocation,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"

type PreserveAltiumNoConnectRecordsInput = {
  document: AltiumSchDoc
  elements: CircuitElement[]
}

type CircuitSchematicPointKey = string
type SchematicPortsByPointKey = Map<CircuitSchematicPointKey, CircuitElement[]>
type SourcePortsById = Map<SourcePortId, CircuitElement>

type FindUnassignedSourcePortInput = {
  assignedSourcePortIds: Set<SourcePortId>
  center: Point
  schematicPortsByPointKey: SchematicPortsByPointKey
  sourcePortsById: SourcePortsById
}

type MatchedSourcePort = {
  sourcePort: CircuitElement
  sourcePortId: SourcePortId
}

function getCircuitSchematicPointKey({
  x,
  y,
}: {
  x: number
  y: number
}): CircuitSchematicPointKey {
  return `${x}:${y}`
}

function getSourcePortsById(elements: CircuitElement[]): SourcePortsById {
  return new Map<SourcePortId, CircuitElement>(
    elements
      .filter((element) => element.type === "source_port")
      .map((sourcePort) => [asString(sourcePort.source_port_id), sourcePort]),
  )
}

function getSchematicPortsByPointKey(
  elements: CircuitElement[],
): SchematicPortsByPointKey {
  const schematicPortsByPointKey: SchematicPortsByPointKey = new Map()
  for (const schematicPort of elements) {
    if (schematicPort.type !== "schematic_port") continue
    const center = asPoint(schematicPort.center)
    if (!center) continue
    const pointKey = getCircuitSchematicPointKey(center)
    schematicPortsByPointKey.set(pointKey, [
      ...(schematicPortsByPointKey.get(pointKey) ?? []),
      schematicPort,
    ])
  }
  return schematicPortsByPointKey
}

function findUnassignedSourcePort({
  assignedSourcePortIds,
  center,
  schematicPortsByPointKey,
  sourcePortsById,
}: FindUnassignedSourcePortInput): MatchedSourcePort | undefined {
  const schematicPorts =
    schematicPortsByPointKey.get(getCircuitSchematicPointKey(center)) ?? []
  for (const schematicPort of schematicPorts) {
    const sourcePortId = asString(schematicPort.source_port_id)
    const sourcePort = sourcePortsById.get(sourcePortId)
    if (sourcePort && !assignedSourcePortIds.has(sourcePortId)) {
      return { sourcePort, sourcePortId }
    }
  }
  return undefined
}

function appendStandaloneNoConnectPort({
  center,
  elements,
  recordIndex,
}: {
  center: Point
  elements: CircuitElement[]
  recordIndex: number
}): void {
  const sourcePortId = `source_port_no_connect_${recordIndex}`
  elements.push(
    {
      type: "source_port",
      source_port_id: sourcePortId,
      name: "No Connect",
      do_not_connect: true,
    },
    {
      type: "schematic_port",
      schematic_port_id: `schematic_port_no_connect_${recordIndex}`,
      source_port_id: sourcePortId,
      center,
    },
  )
}

export function preserveAltiumNoConnectRecords({
  document,
  elements,
}: PreserveAltiumNoConnectRecordsInput): void {
  const sourcePortsById = getSourcePortsById(elements)
  const schematicPortsByPointKey = getSchematicPortsByPointKey(elements)
  const assignedSourcePortIds = new Set<SourcePortId>()
  for (const [recordIndex, record] of document.records.entries()) {
    if (
      record.recordKind !== "22" ||
      document.getParent(record) !== undefined
    ) {
      continue
    }
    const center = toCircuitPoint(getRecordLocation(record))
    const matchedSourcePort = findUnassignedSourcePort({
      assignedSourcePortIds,
      center,
      schematicPortsByPointKey,
      sourcePortsById,
    })
    if (matchedSourcePort) {
      matchedSourcePort.sourcePort.do_not_connect = true
      assignedSourcePortIds.add(matchedSourcePort.sourcePortId)
      continue
    }

    appendStandaloneNoConnectPort({
      center,
      elements,
      recordIndex,
    })
  }
}
