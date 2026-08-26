import { createPcbArcRecordFromBulge } from "./create-pcb-arc-record"
import type { PcbNetEntry } from "./create-pcb-net-entries"
import {
  asPoint,
  asPositiveNumber,
  asString,
  byType,
  formatMil,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
  pointsEqual,
} from "./format"
import { getCircuitPathPointBulge } from "./get-circuit-path-points"
import type { CircuitElement, PointTransform, SourceTraceId } from "./types"

type CreatePcbTraceRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  netByTraceId: ReadonlyMap<SourceTraceId, PcbNetEntry>
}

export function createPcbTraceRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  netByTraceId,
}: CreatePcbTraceRecordsOptions): string[] {
  const recordSources: string[] = []
  for (const trace of byType(circuitJson, "pcb_trace")) {
    const route = Array.isArray(trace.route)
      ? trace.route.flatMap((routePoint) =>
          isCircuitElement(routePoint) && asPoint(routePoint)
            ? [routePoint]
            : [],
        )
      : []
    const net = netByTraceId.get(asString(trace.source_trace_id))
    for (
      let routePointIndex = 1;
      routePointIndex < route.length;
      routePointIndex++
    ) {
      const circuitRouteStart = route[routePointIndex - 1]
      const circuitRouteEnd = route[routePointIndex]
      if (!circuitRouteStart || !circuitRouteEnd) continue
      if (
        circuitRouteStart.route_type === "via" &&
        circuitRouteEnd.route_type === "via"
      ) {
        continue
      }
      const circuitStartPoint = asPoint(circuitRouteStart)
      const circuitEndPoint = asPoint(circuitRouteEnd)
      if (!circuitStartPoint || !circuitEndPoint) continue
      const layer = getAltiumCopperLayer(
        asString(circuitRouteEnd.layer, asString(circuitRouteStart.layer)),
      )
      const widthMm = asPositiveNumber(
        circuitRouteEnd.width,
        asPositiveNumber(circuitRouteStart.width, 0.2),
      )
      const bulge = getCircuitPathPointBulge(circuitRouteStart.bulge)
      if (bulge !== undefined) {
        recordSources.push(
          createPcbArcRecordFromBulge({
            altiumNetIndex: net?.index,
            bulge,
            circuitEndPoint,
            circuitStartPoint,
            circuitToAltiumPcbPoint,
            layer,
            widthMm,
          }),
        )
        continue
      }

      const altiumStartPoint = circuitToAltiumPcbPoint(circuitStartPoint)
      const altiumEndPoint = circuitToAltiumPcbPoint(circuitEndPoint)
      if (pointsEqual(altiumStartPoint, altiumEndPoint)) continue
      recordSources.push(
        [
          "|RECORD=Track",
          ...(net ? [`NET=${net.index}`] : []),
          `LAYER=${layer}`,
          "LOCKED=FALSE",
          `X1=${formatMil(altiumStartPoint.x)}`,
          `Y1=${formatMil(altiumStartPoint.y)}`,
          `X2=${formatMil(altiumEndPoint.x)}`,
          `Y2=${formatMil(altiumEndPoint.y)}`,
          `WIDTH=${formatMil(widthMm * MILLIMETERS_TO_MILS)}`,
        ].join("|"),
      )
    }
  }
  return recordSources
}

function getAltiumCopperLayer(circuitLayer: string): string {
  const normalizedLayer = circuitLayer.toLowerCase()
  if (normalizedLayer === "bottom") return "BOTTOM"
  const innerLayerMatch = /^inner([1-8])$/u.exec(normalizedLayer)
  if (innerLayerMatch?.[1]) return `MID-LAYER${innerLayerMatch[1]}`
  return "TOP"
}
