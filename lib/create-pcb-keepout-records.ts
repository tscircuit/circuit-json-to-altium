import { pcb_keepout } from "circuit-json"
import {
  createAltiumFillRecord,
  createAltiumRegionRecord,
  createAltiumTrackRecords,
  createCirclePoints,
} from "./create-pcb-annotation-primitives"
import { createPcbKeepoutExclusionRule } from "./create-pcb-keepout-exclusion-rule"
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
  let exclusionIndex = 0

  for (const element of circuitJson) {
    if (element.type !== "pcb_keepout") continue
    const keepout = pcb_keepout.parse(element)
    const unionIndex = keepout.excluded_pcb_component_ids?.length
      ? ++exclusionIndex
      : undefined
    if (unionIndex !== undefined) {
      records.push(
        createPcbKeepoutExclusionRule({
          circuitJson,
          excludedComponentIds: keepout.excluded_pcb_component_ids!,
          unionIndex,
        }),
      )
    }
    const markUnion = (record: string) =>
      unionIndex === undefined ? record : `${record}|UNIONINDEX=${unionIndex}`
    if (keepout.shape === "outline" && keepout.stroke_width <= 0) {
      throw new Error(
        `PCB keepout outline ${keepout.pcb_keepout_id} requires a stroke width`,
      )
    }
    for (const layer of keepout.layers.map(getAltiumKeepoutLayer)) {
      if (keepout.shape === "rect") {
        records.push(
          markUnion(
            createAltiumFillRecord({
              center: keepout.center,
              circuitToAltiumPcbPoint,
              heightMm: keepout.height,
              isKeepout: true,
              layer,
              widthMm: keepout.width,
            }),
          ),
        )
        continue
      }
      if (keepout.shape === "circle") {
        records.push(
          markUnion(
            createAltiumRegionRecord({
              circuitPoints: createCirclePoints({
                center: keepout.center,
                radiusMm: keepout.radius,
              }),
              circuitToAltiumPcbPoint,
              isKeepout: true,
              layer,
            }),
          ),
        )
        continue
      }
      records.push(
        ...createAltiumTrackRecords({
          circuitPoints: keepout.outline,
          circuitToAltiumPcbPoint,
          isKeepout: true,
          layer,
          strokeWidthMm: keepout.stroke_width,
        }).map(markUnion),
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
