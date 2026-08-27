import { type PcbSolderPaste, pcb_solder_paste } from "circuit-json"
import {
  createAltiumFillRecord,
  createAltiumRegionRecord,
  createCirclePoints,
  createRoundedRectPoints,
} from "./create-pcb-annotation-primitives"
import type {
  CircuitElement,
  PcbComponentId,
  Point,
  PointTransform,
} from "./types"

type CreatePcbSolderPasteRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: ReadonlyMap<PcbComponentId, number>
}

type PcbSolderPasteRegion = Exclude<
  PcbSolderPaste,
  { shape: "rect" | "rotated_rect" }
>

export function createPcbSolderPasteRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbSolderPasteRecordsOptions): string[] {
  const records: string[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_solder_paste") continue
    const solderPaste = pcb_solder_paste.parse(element)
    const altiumComponentIndex = getAltiumComponentIndex({
      componentIndex,
      pcbComponentId: solderPaste.pcb_component_id,
      pcbSolderPasteId: solderPaste.pcb_solder_paste_id,
    })
    const layer = getAltiumSolderPasteLayer(solderPaste.layer)

    if (solderPaste.shape === "rect") {
      records.push(
        createAltiumFillRecord({
          altiumComponentIndex,
          center: { x: solderPaste.x, y: solderPaste.y },
          circuitToAltiumPcbPoint,
          heightMm: solderPaste.height,
          layer,
          widthMm: solderPaste.width,
        }),
      )
      continue
    }
    if (solderPaste.shape === "rotated_rect") {
      records.push(
        createAltiumFillRecord({
          altiumComponentIndex,
          center: { x: solderPaste.x, y: solderPaste.y },
          circuitToAltiumPcbPoint,
          heightMm: solderPaste.height,
          layer,
          rotationDegrees: solderPaste.ccw_rotation,
          widthMm: solderPaste.width,
        }),
      )
      continue
    }

    records.push(
      createAltiumRegionRecord({
        altiumComponentIndex,
        circuitPoints: getSolderPasteRegionPoints(solderPaste),
        circuitToAltiumPcbPoint,
        layer,
      }),
    )
  }

  return records
}

function getSolderPasteRegionPoints(
  solderPaste: PcbSolderPasteRegion,
): Point[] {
  if (solderPaste.shape === "polygon") return solderPaste.points
  if (solderPaste.shape === "circle") {
    return createCirclePoints({
      center: { x: solderPaste.x, y: solderPaste.y },
      radiusMm: solderPaste.radius,
    })
  }

  const cornerRadiusMm =
    solderPaste.shape === "oval"
      ? Math.min(solderPaste.width, solderPaste.height) / 2
      : solderPaste.radius
  return createRoundedRectPoints({
    center: { x: solderPaste.x, y: solderPaste.y },
    cornerRadiusMm,
    heightMm: solderPaste.height,
    rotationDegrees:
      solderPaste.shape === "rotated_pill"
        ? solderPaste.ccw_rotation
        : undefined,
    widthMm: solderPaste.width,
  })
}

function getAltiumComponentIndex({
  componentIndex,
  pcbComponentId,
  pcbSolderPasteId,
}: {
  componentIndex: ReadonlyMap<PcbComponentId, number>
  pcbComponentId: string | undefined
  pcbSolderPasteId: string
}): number | undefined {
  if (!pcbComponentId) return undefined
  const altiumComponentIndex = componentIndex.get(pcbComponentId)
  if (altiumComponentIndex === undefined) {
    throw new Error(
      `PCB solder paste ${pcbSolderPasteId} references missing component ${pcbComponentId}`,
    )
  }
  return altiumComponentIndex
}

function getAltiumSolderPasteLayer(circuitLayer: string): string {
  const normalizedLayer = circuitLayer.toLowerCase()
  if (normalizedLayer === "top") return "TOPPASTE"
  if (normalizedLayer === "bottom") return "BOTTOMPASTE"
  throw new Error(`Unsupported PCB solder paste layer: ${circuitLayer}`)
}
