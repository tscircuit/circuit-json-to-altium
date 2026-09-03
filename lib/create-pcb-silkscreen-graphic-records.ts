import { createAltiumRegionRecord } from "./create-pcb-annotation-primitives"
import { asPoint, asString, isCircuitElement } from "./format"
import type { CircuitElement, PcbComponentId, PointTransform } from "./types"

type SilkscreenGraphicRings = {
  innerRings: Array<Array<{ x: number; y: number }>>
  outerRing: Array<{ x: number; y: number }>
}

export function createPcbSilkscreenGraphicRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}): string[] {
  const records: string[] = []
  for (const graphic of circuitJson) {
    if (graphic.type !== "pcb_silkscreen_graphic") continue
    const rings = getSilkscreenGraphicRings(graphic)
    if (!rings) continue
    records.push(
      createAltiumRegionRecord({
        altiumComponentIndex: componentIndex.get(
          asString(graphic.pcb_component_id),
        ),
        circuitPoints: rings.outerRing,
        circuitToAltiumPcbPoint,
        innerRings: rings.innerRings,
        layer:
          asString(graphic.layer).toLowerCase() === "bottom"
            ? "BOTTOMOVERLAY"
            : "TOPOVERLAY",
      }),
    )
  }
  return records
}

function getSilkscreenGraphicRings(
  graphic: CircuitElement,
): SilkscreenGraphicRings | undefined {
  if (graphic.shape !== "brep" || !isCircuitElement(graphic.brep_shape)) {
    return undefined
  }
  const outerRing = getRingPoints(graphic.brep_shape.outer_ring)
  if (outerRing.length < 3) return undefined
  const innerRings = Array.isArray(graphic.brep_shape.inner_rings)
    ? graphic.brep_shape.inner_rings
        .map(getRingPoints)
        .filter((ring) => ring.length >= 3)
    : []
  return { innerRings, outerRing }
}

function getRingPoints(ringInput: unknown): Array<{ x: number; y: number }> {
  if (!isCircuitElement(ringInput) || !Array.isArray(ringInput.vertices)) {
    return []
  }
  return ringInput.vertices.flatMap((vertex) => {
    const point = asPoint(vertex)
    return point ? [point] : []
  })
}
