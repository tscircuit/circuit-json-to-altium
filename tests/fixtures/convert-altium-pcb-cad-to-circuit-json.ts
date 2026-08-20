import { Buffer } from "node:buffer"
import {
  AltiumBinaryPcbDoc,
  AltiumComponentBodyRecord,
  type AltiumComponentRecord,
  type AltiumPcbDocument,
  type AltiumPoint,
  getPcbContour,
  parseAltiumMeasurementToMils,
} from "altiumts"
import type { CircuitElement } from "../../lib/types"

type ConvertAltiumPcbCadOptions = {
  componentIds: Map<AltiumComponentRecord, string>
  document: AltiumPcbDocument
  toCircuitLength: (mils: number) => number
  toCircuitPoint: (point: AltiumPoint) => { x: number; y: number }
  toCircuitRotation: (clockwiseDegrees: number) => number
}

export async function convertAltiumPcbCadToCircuitJson({
  componentIds,
  document,
  toCircuitLength,
  toCircuitPoint,
  toCircuitRotation,
}: ConvertAltiumPcbCadOptions): Promise<CircuitElement[]> {
  const elements: CircuitElement[] = []
  for (const [bodyIndex, body] of document
    .getRecordsByKind("ComponentBody")
    .entries()) {
    if (!(body instanceof AltiumComponentBodyRecord)) continue
    const rectangle = getAxisAlignedRectangle(body)
    const component = document.getComponentForRecord(body)
    const pcbComponentId = component ? componentIds.get(component) : undefined
    if (!rectangle || !pcbComponentId) continue

    const layer = body.getDecoded("LAYER")?.toUpperCase().includes("14")
      ? "bottom"
      : "top"
    const heightMils = body.overallHeightMils ?? 0
    const standoffHeightMils = body.standoffHeightMils ?? 0
    const center = toCircuitPoint(rectangle.center)
    const positionZ = toCircuitLength(standoffHeightMils + heightMils / 2)
    const modelPosition = body.modelPosition
    const modelPositionCircuit = modelPosition
      ? toCircuitPoint(modelPosition)
      : center
    const modelPositionZ = toCircuitLength(
      getMeasurementMils(body.getDecoded("MODEL.3D.DZ")) ?? 0,
    )
    const circuitPositionZ = layer === "bottom" ? -positionZ : positionZ
    const modelGlobalPositionZ =
      layer === "bottom" ? -modelPositionZ : modelPositionZ
    const model =
      document instanceof AltiumBinaryPcbDoc
        ? document.getModelForComponentBody(body)
        : undefined
    const embeddedModel =
      document instanceof AltiumBinaryPcbDoc
        ? document.getEmbeddedModelForComponentBody(body)
        : undefined
    const modelName = model?.name ?? `component-body-${bodyIndex}.step`
    const embeddedModelBytes = await embeddedModel?.getDecompressedBytes()

    elements.push({
      type: "cad_component",
      cad_component_id: `cad_component_${bodyIndex}`,
      pcb_component_id: pcbComponentId,
      source_component_id: pcbComponentId.replace(
        "pcb_component",
        "source_component",
      ),
      position: {
        ...center,
        z: circuitPositionZ,
      },
      rotation: {
        x: body.modelRotation3d.x,
        y: body.modelRotation3d.y,
        z: toCircuitRotation(body.modelRotation3d.z),
      },
      size: {
        x: toCircuitLength(rectangle.widthMils),
        y: toCircuitLength(rectangle.heightMils),
        z: toCircuitLength(heightMils),
      },
      layer,
      anchor_alignment: "center",
      model_object_fit: "contain_within_bounds",
      ...(model
        ? {
            model_origin_position: {
              x: center.x - modelPositionCircuit.x,
              y: center.y - modelPositionCircuit.y,
              z: circuitPositionZ - modelGlobalPositionZ,
            },
          }
        : {}),
      ...(embeddedModelBytes
        ? {
            model_asset: {
              project_relative_path: modelName,
              url: `data:model/step;base64,${Buffer.from(embeddedModelBytes).toString("base64")}`,
              mimetype: "model/step",
            },
          }
        : model
          ? { model_step_url: modelName }
          : {}),
      ...(body.opacity !== undefined && body.opacity < 1
        ? { show_as_translucent_model: true }
        : {}),
    })
  }
  return elements
}

function getAxisAlignedRectangle(body: AltiumComponentBodyRecord):
  | {
      center: AltiumPoint
      heightMils: number
      widthMils: number
    }
  | undefined {
  const points = getPcbContour(body).points
  const uniquePoints = points.filter(
    (point, index) =>
      points.findIndex(
        (candidate) => candidate.x === point.x && candidate.y === point.y,
      ) === index,
  )
  if (uniquePoints.length !== 4) return undefined
  const xCoordinates = [...new Set(uniquePoints.map((point) => point.x))]
  const yCoordinates = [...new Set(uniquePoints.map((point) => point.y))]
  if (xCoordinates.length !== 2 || yCoordinates.length !== 2) return undefined
  const minX = Math.min(...xCoordinates)
  const maxX = Math.max(...xCoordinates)
  const minY = Math.min(...yCoordinates)
  const maxY = Math.max(...yCoordinates)
  if (
    !xCoordinates.every((x) =>
      yCoordinates.every((y) =>
        uniquePoints.some((point) => point.x === x && point.y === y),
      ),
    )
  ) {
    return undefined
  }
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    heightMils: maxY - minY,
    widthMils: maxX - minX,
  }
}

function getMeasurementMils(
  measurement: string | undefined,
): number | undefined {
  return parseAltiumMeasurementToMils(measurement)
}
