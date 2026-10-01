import type { CircuitElement } from "../../lib/types"
import {
  asPoint,
  asString,
  asStrings,
  formatLayer,
  formatPoint,
  type PcbSemanticOrigin,
} from "./pcb-semantic-signature-utils"

export type PcbSemanticContext = {
  componentDescriptorByPcbComponentId: Map<string, string>
  netNamesBySourceTraceId: Map<string, string[]>
  origin: PcbSemanticOrigin
  sourceNetNameById: Map<string, string>
  sourcePortDescriptorById: Map<string, string>
}

function getBoardOrigin(circuitJson: CircuitElement[]): PcbSemanticOrigin {
  const board = circuitJson.find((element) => element.type === "pcb_board")
  const outline = Array.isArray(board?.outline)
    ? board.outline.flatMap((value) => {
        const point = asPoint(value)
        return point ? [point] : []
      })
    : []
  if (outline.length === 0) return { x: 0, y: 0 }
  return {
    x: Math.min(...outline.map((point) => point.x)),
    y: Math.min(...outline.map((point) => point.y)),
  }
}

function getSourceNetNameById(
  circuitJson: CircuitElement[],
): Map<string, string> {
  return new Map(
    circuitJson.flatMap((element) => {
      if (element.type !== "source_net") return []
      const sourceNetId = asString(element.source_net_id)
      const name = asString(element.name)
      return sourceNetId === undefined || name === undefined
        ? []
        : [[sourceNetId, name] as const]
    }),
  )
}

function getComponentDescriptorByPcbComponentId({
  circuitJson,
  origin,
}: {
  circuitJson: CircuitElement[]
  origin: PcbSemanticOrigin
}): Map<string, string> {
  return new Map(
    circuitJson.flatMap((element) => {
      if (element.type !== "pcb_component") return []
      const pcbComponentId = asString(element.pcb_component_id)
      const center = asPoint(element.center)
      if (!pcbComponentId || !center) return []
      return [
        [
          pcbComponentId,
          `at=${formatPoint(center, origin)}|side=${formatLayer(element.layer)}`,
        ] as const,
      ]
    }),
  )
}

function getComponentDescriptorBySourceComponentId({
  circuitJson,
  componentDescriptorByPcbComponentId,
}: {
  circuitJson: CircuitElement[]
  componentDescriptorByPcbComponentId: Map<string, string>
}): Map<string, string> {
  return new Map(
    circuitJson.flatMap((element) => {
      if (element.type !== "pcb_component") return []
      const pcbComponentId = asString(element.pcb_component_id)
      const sourceComponentId = asString(element.source_component_id)
      if (!pcbComponentId || !sourceComponentId) return []
      const descriptor = componentDescriptorByPcbComponentId.get(pcbComponentId)
      return descriptor ? [[sourceComponentId, descriptor] as const] : []
    }),
  )
}

function getSourcePortDescriptorById({
  circuitJson,
  componentDescriptorBySourceComponentId,
}: {
  circuitJson: CircuitElement[]
  componentDescriptorBySourceComponentId: Map<string, string>
}): Map<string, string> {
  return new Map(
    circuitJson.flatMap((element) => {
      if (element.type !== "source_port") return []
      const sourcePortId = asString(element.source_port_id)
      if (!sourcePortId) return []
      const sourceComponentId = asString(element.source_component_id)
      const component = sourceComponentId
        ? componentDescriptorBySourceComponentId.get(sourceComponentId)
        : undefined
      return [
        [
          sourcePortId,
          [
            component ?? "<standalone>",
            `pin=${JSON.stringify(asString(element.pin_number) ?? "")}`,
            `name=${JSON.stringify(asString(element.name) ?? "")}`,
          ].join("|"),
        ] as const,
      ]
    }),
  )
}

function getNetNamesBySourceTraceId({
  circuitJson,
  sourceNetNameById,
}: {
  circuitJson: CircuitElement[]
  sourceNetNameById: Map<string, string>
}): Map<string, string[]> {
  return new Map(
    circuitJson.flatMap((element) => {
      if (element.type !== "source_trace") return []
      const sourceTraceId = asString(element.source_trace_id)
      if (!sourceTraceId) return []
      const netNames = asStrings(element.connected_source_net_ids)
        .flatMap((sourceNetId) => {
          const name = sourceNetNameById.get(sourceNetId)
          return name === undefined ? [] : [name]
        })
        .sort()
      return [[sourceTraceId, netNames] as const]
    }),
  )
}

export function getPcbSemanticContext(
  circuitJson: CircuitElement[],
): PcbSemanticContext {
  const origin = getBoardOrigin(circuitJson)
  const sourceNetNameById = getSourceNetNameById(circuitJson)
  const componentDescriptorByPcbComponentId =
    getComponentDescriptorByPcbComponentId({ circuitJson, origin })
  const componentDescriptorBySourceComponentId =
    getComponentDescriptorBySourceComponentId({
      circuitJson,
      componentDescriptorByPcbComponentId,
    })
  return {
    componentDescriptorByPcbComponentId,
    netNamesBySourceTraceId: getNetNamesBySourceTraceId({
      circuitJson,
      sourceNetNameById,
    }),
    origin,
    sourceNetNameById,
    sourcePortDescriptorById: getSourcePortDescriptorById({
      circuitJson,
      componentDescriptorBySourceComponentId,
    }),
  }
}
