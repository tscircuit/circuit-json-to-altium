import { asString } from "./format"

export function getAltiumPcbCopperLayerName(
  circuitLayer: unknown,
): string | undefined {
  const normalizedLayer = asString(circuitLayer).toLowerCase()
  if (normalizedLayer === "top") return "TOP"
  if (normalizedLayer === "bottom") return "BOTTOM"
  const innerLayerMatch = /^inner([1-9]\d*)$/u.exec(normalizedLayer)
  if (!innerLayerMatch) return undefined
  return `MID-LAYER${Number(innerLayerMatch[1])}`
}
