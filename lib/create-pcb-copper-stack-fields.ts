import { asNumber, asString, isCircuitElement } from "./format"
import type { CircuitElement } from "./types"

export function createPcbCopperStackFields(
  circuitJson: CircuitElement[],
  board: CircuitElement | undefined,
): string[] {
  let layerCount = asNumber(board?.num_layers, 2)
  for (const element of circuitJson) {
    const layers = [element.layer]
    if (element.type === "pcb_trace" && Array.isArray(element.route)) {
      layers.push(
        ...element.route.filter(isCircuitElement).map((point) => point.layer),
      )
    }
    if (element.type === "pcb_via" && Array.isArray(element.layers)) {
      layers.push(...element.layers)
    }
    for (const layer of layers) {
      const inner = /^inner([1-8])$/.exec(asString(layer).toLowerCase())
      if (inner) layerCount = Math.max(layerCount, Number(inner[1]) + 2)
    }
  }
  if (!Number.isInteger(layerCount) || layerCount < 2 || layerCount > 10) {
    throw new Error(`Unsupported PCB copper layer count: ${layerCount}`)
  }
  if (layerCount === 2) return []
  return Array.from({ length: layerCount }, (_, index) => {
    const isTop = index === 0
    const isBottom = index === layerCount - 1
    const name = isTop
      ? "Top Layer"
      : isBottom
        ? "Bottom Layer"
        : `Mid-Layer ${index}`
    const id = isBottom ? 0x100ffff : 0x1000001 + index
    return [`LAYER_V8_${index}NAME=${name}`, `LAYER_V8_${index}LAYERID=${id}`]
  }).flat()
}
