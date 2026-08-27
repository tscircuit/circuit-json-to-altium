import {
  type AltiumComponentRecord,
  type AltiumPcbDocument,
  type AltiumPoint,
  type AltiumRecord,
  getPcbRegionGeometry,
  normalizeAltiumAngle,
  parseAltiumMeasurementToMils,
} from "altiumts"
import type { CircuitElement } from "../../lib/types"

const MILLIMETERS_PER_MIL = 0.0254

type AppendAltiumPcbSolderPasteElementsOptions = {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
  elements: CircuitElement[]
}

export function appendAltiumPcbSolderPasteElements({
  componentIds,
  document,
  elements,
}: AppendAltiumPcbSolderPasteElementsOptions): void {
  appendSolderPasteFills({ componentIds, document, elements })
  appendSolderPasteRegions({ componentIds, document, elements })
}

function appendSolderPasteFills({
  componentIds,
  document,
  elements,
}: AppendAltiumPcbSolderPasteElementsOptions): void {
  for (const [fillIndex, fill] of document.getRecordsByKind("Fill").entries()) {
    const layer = fill.getDecoded("LAYER")
    if (!isSolderPasteLayer(layer)) continue
    const start = getPoint(fill, "X1", "Y1")
    const end = getPoint(fill, "X2", "Y2")
    if (!start || !end) continue

    const ccwRotationDegrees = normalizeAltiumAngle(
      fill.getNumber("ROTATION") ?? 0,
    )
    const pcbComponentId = getOwnedComponentId({
      componentIds,
      document,
      record: fill,
    })
    elements.push({
      type: "pcb_solder_paste",
      pcb_solder_paste_id: `pcb_solder_paste_fill_${fillIndex}`,
      ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
      shape: ccwRotationDegrees === 0 ? "rect" : "rotated_rect",
      x: toCircuitLength((start.x + end.x) / 2),
      y: toCircuitLength((start.y + end.y) / 2),
      width: toCircuitLength(Math.abs(end.x - start.x)),
      height: toCircuitLength(Math.abs(end.y - start.y)),
      ...(ccwRotationDegrees === 0 ? {} : { ccw_rotation: ccwRotationDegrees }),
      layer: toCircuitLayer(layer),
    })
  }
}

function appendSolderPasteRegions({
  componentIds,
  document,
  elements,
}: AppendAltiumPcbSolderPasteElementsOptions): void {
  for (const [regionIndex, region] of document
    .getRecordsByKind("Region")
    .entries()) {
    const layer = region.getDecoded("LAYER")
    if (!isSolderPasteLayer(layer)) continue
    const geometry = getPcbRegionGeometry(region)
    if (geometry.holes.length > 0) {
      throw new Error("Circuit JSON solder paste polygons cannot contain holes")
    }
    const points = geometry.outline.isExplicitlyClosed
      ? geometry.outline.points.slice(0, -1)
      : geometry.outline.points
    if (points.length < 3) continue
    const pcbComponentId = getOwnedComponentId({
      componentIds,
      document,
      record: region,
    })
    elements.push({
      type: "pcb_solder_paste",
      pcb_solder_paste_id: `pcb_solder_paste_region_${regionIndex}`,
      ...(pcbComponentId ? { pcb_component_id: pcbComponentId } : {}),
      shape: "polygon",
      points: points.map(toCircuitPoint),
      layer: toCircuitLayer(layer),
    })
  }
}

function getOwnedComponentId({
  componentIds,
  document,
  record,
}: {
  componentIds: ReadonlyMap<AltiumComponentRecord, string>
  document: AltiumPcbDocument
  record: AltiumRecord
}): string | undefined {
  const component = document.getComponentForRecord(record)
  return component ? componentIds.get(component) : undefined
}

function getPoint(
  record: AltiumRecord,
  xFieldName: string,
  yFieldName: string,
): AltiumPoint | undefined {
  const x = parseAltiumMeasurementToMils(record.getCaseInsensitive(xFieldName))
  const y = parseAltiumMeasurementToMils(record.getCaseInsensitive(yFieldName))
  return x === undefined || y === undefined ? undefined : { x, y }
}

function isSolderPasteLayer(layer: string | undefined): boolean {
  const normalizedLayer = normalizeLayer(layer)
  return normalizedLayer === "TOPPASTE" || normalizedLayer === "BOTTOMPASTE"
}

function normalizeLayer(layer: string | undefined): string {
  return layer?.replace(/[\s_-]+/gu, "").toUpperCase() ?? ""
}

function toCircuitLayer(layer: string | undefined): "bottom" | "top" {
  return normalizeLayer(layer) === "BOTTOMPASTE" ? "bottom" : "top"
}

function toCircuitPoint(point: AltiumPoint): { x: number; y: number } {
  return { x: toCircuitLength(point.x), y: toCircuitLength(point.y) }
}

function toCircuitLength(mils: number): number {
  return mils * MILLIMETERS_PER_MIL
}
