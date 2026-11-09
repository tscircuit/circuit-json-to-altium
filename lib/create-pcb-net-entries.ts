import { asString, byType, sanitizeField } from "./format"
import { TraceConnectivity } from "./trace-connectivity"
import type {
  CircuitElement,
  PcbNetName,
  SourceNetId,
  SourcePortId,
  SourceTraceId,
} from "./types"

export type PcbNetEntry = {
  index: number
  name: PcbNetName
  sourceNetIds: SourceNetId[]
  sourcePortIds: SourcePortId[]
  traceIds: SourceTraceId[]
}

type GetUniquePcbNetNameOptions = {
  basePcbNetName: PcbNetName
  useCountByPcbNetName: Map<PcbNetName, number>
}

function getUniquePcbNetName({
  basePcbNetName,
  useCountByPcbNetName,
}: GetUniquePcbNetNameOptions): PcbNetName {
  const pcbNetNameUseCount = (useCountByPcbNetName.get(basePcbNetName) ?? 0) + 1
  useCountByPcbNetName.set(basePcbNetName, pcbNetNameUseCount)
  return pcbNetNameUseCount === 1
    ? basePcbNetName
    : `${basePcbNetName}-${pcbNetNameUseCount}`
}

function getPcbNetDeclarationOrder(
  pcbNetEntry: PcbNetEntry,
  sourceNetOrderBySourceNetId: Map<SourceNetId, number>,
): number {
  return Math.min(
    ...pcbNetEntry.sourceNetIds.map(
      (sourceNetId) =>
        sourceNetOrderBySourceNetId.get(sourceNetId) ??
        Number.POSITIVE_INFINITY,
    ),
  )
}

export const createPcbNetEntries = (
  circuitJson: CircuitElement[],
): PcbNetEntry[] => {
  const pcbNetNameBySourceNetId = new Map<SourceNetId, PcbNetName>(
    byType(circuitJson, "source_net").flatMap((sourceNet) => {
      const sourceNetId = asString(sourceNet.source_net_id)
      if (!sourceNetId) return []
      return [
        [sourceNetId, sanitizeField(sourceNet.name) || sourceNetId] as const,
      ]
    }),
  )
  const sourceNetOrderBySourceNetId = new Map<SourceNetId, number>(
    [...pcbNetNameBySourceNetId.keys()].map((sourceNetId, index) => [
      sourceNetId,
      index,
    ]),
  )
  const sourceTraces = byType(circuitJson, "source_trace")
  const traceConnectivity = new TraceConnectivity(sourceTraces.length)
  const firstTraceBySourcePortId = new Map<SourcePortId, number>()
  const firstTraceBySourceNetId = new Map<SourceNetId, number>()
  for (const [traceIndex, trace] of sourceTraces.entries()) {
    const sourcePortIds = Array.isArray(trace.connected_source_port_ids)
      ? trace.connected_source_port_ids.map((sourcePortId) =>
          asString(sourcePortId),
        )
      : []
    const sourceNetIds = Array.isArray(trace.connected_source_net_ids)
      ? trace.connected_source_net_ids.map((sourceNetId) =>
          asString(sourceNetId),
        )
      : []
    for (const [connectionId, firstTraceByConnectionId] of [
      ...sourcePortIds.map(
        (sourcePortId) => [sourcePortId, firstTraceBySourcePortId] as const,
      ),
      ...sourceNetIds.map(
        (sourceNetId) => [sourceNetId, firstTraceBySourceNetId] as const,
      ),
    ]) {
      if (!connectionId) continue
      const firstTraceIndex = firstTraceByConnectionId.get(connectionId)
      if (firstTraceIndex === undefined) {
        firstTraceByConnectionId.set(connectionId, traceIndex)
      } else {
        traceConnectivity.connect(firstTraceIndex, traceIndex)
      }
    }
  }

  const traceIndexesByRoot = new Map<number, number[]>()
  for (const traceIndex of sourceTraces.keys()) {
    const rootTraceIndex = traceConnectivity.getRoot(traceIndex)
    traceIndexesByRoot.set(rootTraceIndex, [
      ...(traceIndexesByRoot.get(rootTraceIndex) ?? []),
      traceIndex,
    ])
  }
  const useCountByPcbNetName = new Map<PcbNetName, number>()
  const netEntries: PcbNetEntry[] = []
  for (const traceIndexes of traceIndexesByRoot.values()) {
    const traces = traceIndexes.flatMap((traceIndex) => {
      const trace = sourceTraces[traceIndex]
      return trace ? [trace] : []
    })
    const sourceNetIds = [
      ...new Set(
        traces.flatMap((trace) =>
          Array.isArray(trace.connected_source_net_ids)
            ? trace.connected_source_net_ids
                .map((sourceNetId) => asString(sourceNetId))
                .filter(Boolean)
            : [],
        ),
      ),
    ]
    const sourcePortIds = [
      ...new Set(
        traces.flatMap((trace) =>
          Array.isArray(trace.connected_source_port_ids)
            ? trace.connected_source_port_ids
                .map((sourcePortId) => asString(sourcePortId))
                .filter(Boolean)
            : [],
        ),
      ),
    ]
    const tracePcbNetName = traces
      .map(
        (trace) =>
          sanitizeField(trace.name) || sanitizeField(trace.display_name),
      )
      .find(Boolean)
    if (
      sourceNetIds.length === 0 &&
      sourcePortIds.length === 0 &&
      !tracePcbNetName
    ) {
      continue
    }

    const index = netEntries.length
    const basePcbNetName =
      sourceNetIds
        .map((sourceNetId) => pcbNetNameBySourceNetId.get(sourceNetId))
        .find(Boolean) ||
      tracePcbNetName ||
      `Net-${index + 1}`
    netEntries.push({
      index,
      name: getUniquePcbNetName({
        basePcbNetName,
        useCountByPcbNetName,
      }),
      sourceNetIds,
      sourcePortIds,
      traceIds: traces.map(
        (trace, traceOffset) =>
          asString(trace.source_trace_id) ||
          `source_trace_${traceIndexes[traceOffset] ?? traceOffset}`,
      ),
    })
  }

  const representedSourceNetIds = new Set(
    netEntries.flatMap((netEntry) => netEntry.sourceNetIds),
  )
  const referencedSourceNetIds = new Set([
    ...pcbNetNameBySourceNetId.keys(),
    ...[
      ...byType(circuitJson, "pcb_copper_pour"),
      ...byType(circuitJson, "pcb_via"),
    ]
      .map((element) => asString(element.source_net_id))
      .filter(Boolean),
  ])
  for (const sourceNetId of referencedSourceNetIds) {
    if (representedSourceNetIds.has(sourceNetId)) continue
    const basePcbNetName =
      pcbNetNameBySourceNetId.get(sourceNetId) ?? sourceNetId
    netEntries.push({
      index: netEntries.length,
      name: getUniquePcbNetName({
        basePcbNetName,
        useCountByPcbNetName,
      }),
      sourceNetIds: [sourceNetId],
      sourcePortIds: [],
      traceIds: [],
    })
    representedSourceNetIds.add(sourceNetId)
  }

  netEntries.sort((leftPcbNetEntry, rightPcbNetEntry) => {
    const leftDeclarationOrder = getPcbNetDeclarationOrder(
      leftPcbNetEntry,
      sourceNetOrderBySourceNetId,
    )
    const rightDeclarationOrder = getPcbNetDeclarationOrder(
      rightPcbNetEntry,
      sourceNetOrderBySourceNetId,
    )
    if (leftDeclarationOrder !== rightDeclarationOrder) {
      return leftDeclarationOrder - rightDeclarationOrder
    }
    return leftPcbNetEntry.index - rightPcbNetEntry.index
  })
  for (const [index, pcbNetEntry] of netEntries.entries()) {
    pcbNetEntry.index = index
  }

  return netEntries
}
