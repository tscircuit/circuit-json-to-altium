import { pcb_keepout } from "circuit-json"
import { createAltiumFillRecord } from "./create-pcb-annotation-primitives"
import { createPcbFullCircleArcRecord } from "./create-pcb-arc-record"
import type { CircuitElement, PointTransform } from "./types"

type CreatePcbKeepoutRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
}

export function createPcbKeepoutRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
}: CreatePcbKeepoutRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_keepout") continue
    const keepout = pcb_keepout.parse(element)
    if (keepout.excluded_pcb_component_ids?.length) {
      throw new Error(
        `PCB keepout ${keepout.pcb_keepout_id} excludes components, which Altium primitive keepouts cannot preserve`,
      )
    }
    for (const layer of keepout.layers.map(getAltiumKeepoutLayer)) {
      records.push(
        keepout.shape === "rect"
          ? createAltiumFillRecord({
              center: keepout.center,
              circuitToAltiumPcbPoint,
              heightMm: keepout.height,
              isKeepout: true,
              layer,
              widthMm: keepout.width,
            })
          : createPcbFullCircleArcRecord({
              center: keepout.center,
              circuitToAltiumPcbPoint,
              isKeepout: true,
              layer,
              radiusMm: keepout.radius,
              widthMm: 0.1,
            }),
      )
    }
  }

  return records
}

function getAltiumKeepoutLayer(circuitLayer: string): string {
  const normalizedLayer = circuitLayer.toLowerCase()
  if (normalizedLayer === "top") return "TOP"
  if (normalizedLayer === "bottom") return "BOTTOM"
  if (normalizedLayer === "all" || normalizedLayer === "multilayer") {
    return "KEEPOUT"
  }
  const innerLayerMatch = /^inner(\d+)$/u.exec(normalizedLayer)
  if (innerLayerMatch?.[1]) {
    return `MID-LAYER${Number(innerLayerMatch[1])}`
  }
  throw new Error(`Unsupported PCB keepout layer: ${circuitLayer}`)
}
