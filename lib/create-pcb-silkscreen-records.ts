import { createAltiumPcbPathRecords } from "./create-pcb-annotation-primitives"
import { createPcbFullCircleArcRecord } from "./create-pcb-arc-record"
import { asPoint, asString, byType } from "./format"
import { getCircuitPathPoints } from "./get-circuit-path-points"
import type { CircuitElement, PcbComponentId, PointTransform } from "./types"

type CreatePcbSilkscreenRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}

export function createPcbSilkscreenRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbSilkscreenRecordsOptions): string[] {
  return [
    ...createPcbSilkscreenPathRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
    ...createPcbSilkscreenCircleRecords({
      circuitJson,
      circuitToAltiumPcbPoint,
      componentIndex,
    }),
  ]
}

function createPcbSilkscreenPathRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbSilkscreenRecordsOptions): string[] {
  const recordSources: string[] = []
  for (const silkscreenPath of byType(circuitJson, "pcb_silkscreen_path")) {
    const altiumComponentIndex = componentIndex.get(
      asString(silkscreenPath.pcb_component_id),
    )
    recordSources.push(
      ...createAltiumPcbPathRecords({
        altiumComponentIndex,
        circuitPoints: getCircuitPathPoints(silkscreenPath.route),
        circuitToAltiumPcbPoint,
        layer: getAltiumSilkscreenLayer(asString(silkscreenPath.layer)),
        strokeWidthMm: getSilkscreenStrokeWidthMm(silkscreenPath.stroke_width),
      }),
    )
  }
  return recordSources
}

function createPcbSilkscreenCircleRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbSilkscreenRecordsOptions): string[] {
  return byType(circuitJson, "pcb_silkscreen_circle").map(
    (silkscreenCircle) => {
      if (silkscreenCircle.is_filled === true) {
        throw new Error(
          "Altium PCB arcs cannot preserve filled silkscreen circles",
        )
      }
      const center = asPoint(silkscreenCircle.center)
      if (!center) throw new Error("A PCB silkscreen circle requires a center")
      return createPcbFullCircleArcRecord({
        altiumComponentIndex: componentIndex.get(
          asString(silkscreenCircle.pcb_component_id),
        ),
        center,
        circuitToAltiumPcbPoint,
        layer: getAltiumSilkscreenLayer(asString(silkscreenCircle.layer)),
        radiusMm: getPositiveRadiusMm(silkscreenCircle.radius),
        widthMm: getSilkscreenStrokeWidthMm(silkscreenCircle.stroke_width),
      })
    },
  )
}

function getSilkscreenStrokeWidthMm(strokeWidth: unknown): number {
  return typeof strokeWidth === "number" && strokeWidth >= 0
    ? strokeWidth
    : 0.15
}

function getPositiveRadiusMm(radius: unknown): number {
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius <= 0) {
    throw new Error("A PCB silkscreen circle requires a positive radius")
  }
  return radius
}

function getAltiumSilkscreenLayer(circuitLayer: string): string {
  return circuitLayer.toLowerCase() === "bottom"
    ? "BOTTOMOVERLAY"
    : "TOPOVERLAY"
}
