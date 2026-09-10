import { pcb_keepout } from "circuit-json"
import {
  createAltiumFillRecord,
  createAltiumRegionRecord,
  createAltiumTrackRecords,
  createCirclePoints,
} from "./create-pcb-annotation-primitives"
import type { CircuitElement, PointTransform } from "./types"

type CreatePcbKeepoutRecordsOptions = {
  circuitJson: CircuitElement[]
  warnings?: string[]
  circuitToAltiumPcbPoint: PointTransform
}

export function createPcbKeepoutRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  warnings,
}: CreatePcbKeepoutRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_keepout") continue
    const keepout = pcb_keepout.parse(element)
    if (keepout.excluded_pcb_component_ids?.length) {
      const excludedComponents = keepout.excluded_pcb_component_ids.map(
        (id) => {
          const component = circuitJson.find(
            (item) =>
              item.type === "pcb_component" && item.pcb_component_id === id,
          )
          const source =
            component &&
            circuitJson.find(
              (item) =>
                item.type === "source_component" &&
                item.source_component_id === component.source_component_id,
            )
          return source?.name ? `${source.name} (${id})` : id
        },
      )
      const warning = `PCB keepout ${keepout.pcb_keepout_id}: Altium primitive keepouts cannot preserve component exclusions for ${excludedComponents.join(", ")}. The keepout geometry and layers are retained, but apply to these components too. Review the keepout clearance rules in Altium before editing or manufacturing.`
      if (warnings) warnings.push(warning)
      else console.warn(warning)
    }
    if (keepout.shape === "outline" && keepout.stroke_width <= 0) {
      throw new Error(
        `PCB keepout outline ${keepout.pcb_keepout_id} requires a stroke width`,
      )
    }
    for (const layer of keepout.layers.map(getAltiumKeepoutLayer)) {
      if (keepout.shape === "rect") {
        records.push(
          createAltiumFillRecord({
            center: keepout.center,
            circuitToAltiumPcbPoint,
            heightMm: keepout.height,
            isKeepout: true,
            layer,
            widthMm: keepout.width,
          }),
        )
        continue
      }
      if (keepout.shape === "circle") {
        records.push(
          createAltiumRegionRecord({
            circuitPoints: createCirclePoints({
              center: keepout.center,
              radiusMm: keepout.radius,
            }),
            circuitToAltiumPcbPoint,
            isKeepout: true,
            layer,
          }),
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
