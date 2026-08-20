import type { AltiumEmbeddedModelInput } from "altiumts"
import { convertCircuitPcbCcwRotationDegreesToAltium } from "./convert-circuit-pcb-ccw-rotation-degrees-to-altium"
import {
  asNumber,
  asPoint,
  asString,
  byType,
  formatMil,
  formatNumber,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
  sanitizeField,
} from "./format"
import type {
  CircuitElement,
  PcbComponentId,
  Point,
  PointTransform,
} from "./types"

type Point3 = Point & { z: number }

type PcbComponentBodyRecords = {
  embeddedModels: AltiumEmbeddedModelInput[]
  recordSources: string[]
}

type CreatePcbComponentBodyRecordsOptions = {
  circuitJson: CircuitElement[]
  circuitToAltiumPcbPoint: PointTransform
  componentIndex: Map<PcbComponentId, number>
}

type StepModel = {
  bytes?: Uint8Array
  name: string
}

export function createPcbComponentBodyRecords({
  circuitJson,
  circuitToAltiumPcbPoint,
  componentIndex,
}: CreatePcbComponentBodyRecordsOptions): PcbComponentBodyRecords {
  const boardThicknessMm = getBoardThicknessMm(circuitJson)
  const embeddedModels: AltiumEmbeddedModelInput[] = []
  const recordSources: string[] = []
  let modelIndex = 0

  for (const cadComponent of byType(circuitJson, "cad_component")) {
    const pcbComponentId = asString(cadComponent.pcb_component_id)
    const altiumComponentIndex = componentIndex.get(pcbComponentId)
    if (altiumComponentIndex === undefined) continue

    const position = asPoint3(cadComponent.position)
    const size = asPoint3(cadComponent.size)
    const stepModel = getStepModel(cadComponent)
    if (!position || !size) {
      if (stepModel) {
        throw new Error(
          `CAD component ${JSON.stringify(asString(cadComponent.cad_component_id))} needs position and size to attach an Altium STEP model`,
        )
      }
      continue
    }
    assertPositiveSize(size, asString(cadComponent.cad_component_id))
    assertSupportedModelTransform(cadComponent)

    const layer = getCadComponentLayer(cadComponent)
    const halfWidthMm = size.x / 2
    const halfHeightMm = size.y / 2
    const corners = [
      { x: position.x - halfWidthMm, y: position.y - halfHeightMm },
      { x: position.x + halfWidthMm, y: position.y - halfHeightMm },
      { x: position.x + halfWidthMm, y: position.y + halfHeightMm },
      { x: position.x - halfWidthMm, y: position.y + halfHeightMm },
      { x: position.x - halfWidthMm, y: position.y - halfHeightMm },
    ].map(circuitToAltiumPcbPoint)
    const rotation = asPoint3(cadComponent.rotation) ?? { x: 0, y: 0, z: 0 }
    const altiumRotationZ = convertCircuitPcbCcwRotationDegreesToAltium(
      rotation.z,
    )
    const bodyStandoffHeightMm = getBodyStandoffHeightMm({
      boardThicknessMm,
      layer,
      positionZMm: position.z,
      sizeZMm: size.z,
    })
    const modelOriginPosition = asPoint3(
      cadComponent.model_origin_position,
    ) ?? {
      x: 0,
      y: 0,
      z: 0,
    }
    const modelPosition = circuitToAltiumPcbPoint({
      x: position.x - modelOriginPosition.x,
      y: position.y - modelOriginPosition.y,
    })
    const modelPositionZMm = getModelPositionZMm({
      boardThicknessMm,
      layer,
      modelGlobalPositionZMm: position.z - modelOriginPosition.z,
    })
    const modelId = `{TSCIRCUIT-MODEL-${modelIndex}}`
    const hasModel = stepModel !== undefined

    if (stepModel) {
      recordSources.push(
        createModelRecord({
          embedded: stepModel.bytes !== undefined,
          modelId,
          modelPositionZMm,
          modelName: stepModel.name,
          rotation,
          altiumRotationZ,
        }),
      )
      if (stepModel.bytes) {
        embeddedModels.push({ bytes: stepModel.bytes, modelIndex })
      }
    }

    recordSources.push(
      [
        "|RECORD=ComponentBody",
        `LAYER=${layer === "bottom" ? "MECHANICAL14" : "MECHANICAL13"}`,
        "LOCKED=FALSE",
        "KEEPOUT=FALSE",
        "NET=65535",
        "POLYGON=65535",
        `COMPONENT=${altiumComponentIndex}`,
        "TEARDROP=FALSE",
        "HOLECOUNT=0",
        "ISSHAPEBASED=TRUE",
        "KIND=0",
        ...(hasModel
          ? [
              `MODELID=${modelId}`,
              `MODEL.EMBED=${stepModel.bytes ? "TRUE" : "FALSE"}`,
              "MODEL.CHECKSUM=0",
              "MODEL.MODELTYPE=0",
              "MODEL.SNAPCOUNT=0",
              `MODEL.2D.X=${formatMil(modelPosition.x)}`,
              `MODEL.2D.Y=${formatMil(modelPosition.y)}`,
              `MODEL.2D.ROTATION=${formatNumber(altiumRotationZ)}`,
              `MODEL.3D.DZ=${formatMil(modelPositionZMm * MILLIMETERS_TO_MILS)}`,
              `MODEL.3D.ROTX=${formatNumber(rotation.x)}`,
              `MODEL.3D.ROTY=${formatNumber(rotation.y)}`,
              `MODEL.3D.ROTZ=${formatNumber(altiumRotationZ)}`,
            ]
          : []),
        `STANDOFFHEIGHT=${formatMil(bodyStandoffHeightMm * MILLIMETERS_TO_MILS)}`,
        `OVERALLHEIGHT=${formatMil(size.z * MILLIMETERS_TO_MILS)}`,
        `BODYOPACITY3D=${cadComponent.show_as_translucent_model === true ? "0.5" : "1"}`,
        `V7_LAYER=${layer === "bottom" ? "14" : "13"}`,
        ...corners.flatMap((corner, cornerIndex) => [
          `KIND${cornerIndex}=0`,
          `VX${cornerIndex}=${formatMil(corner.x)}`,
          `VY${cornerIndex}=${formatMil(corner.y)}`,
        ]),
      ].join("|"),
    )
    if (hasModel) modelIndex++
  }

  return { embeddedModels, recordSources }
}

function createModelRecord({
  altiumRotationZ,
  embedded,
  modelId,
  modelName,
  modelPositionZMm,
  rotation,
}: {
  altiumRotationZ: number
  embedded: boolean
  modelId: string
  modelName: string
  modelPositionZMm: number
  rotation: Point3
}): string {
  const modelPositionZInternalUnits = Math.round(
    modelPositionZMm * MILLIMETERS_TO_MILS * 10_000,
  )
  return [
    "|RECORD=Model",
    `ID=${modelId}`,
    `ROTX=${formatNumber(rotation.x)}`,
    `ROTY=${formatNumber(rotation.y)}`,
    `ROTZ=${formatNumber(altiumRotationZ)}`,
    `DZ=${modelPositionZInternalUnits}`,
    "CHECKSUM=0",
    `EMBED=${embedded ? "TRUE" : "FALSE"}`,
    `NAME=${sanitizeField(modelName)}`,
  ].join("|")
}

function asPoint3(input: unknown): Point3 | undefined {
  if (!isCircuitElement(input)) return undefined
  const point = asPoint(input)
  if (!point || typeof input.z !== "number" || !Number.isFinite(input.z)) {
    return undefined
  }
  return { ...point, z: input.z }
}

function assertPositiveSize(size: Point3, cadComponentId: string): void {
  if (size.x > 0 && size.y > 0 && size.z >= 0) return
  throw new Error(
    `CAD component ${JSON.stringify(cadComponentId)} has an invalid size`,
  )
}

function assertSupportedModelTransform(cadComponent: CircuitElement): void {
  const scale = asNumber(cadComponent.model_unit_to_mm_scale_factor, 1)
  if (scale !== 1) {
    throw new Error(
      `Altium STEP model serialization does not support model scale ${scale}`,
    )
  }
  const normalDirection = asString(
    cadComponent.model_board_normal_direction,
    "z+",
  )
  if (normalDirection !== "z+") {
    throw new Error(
      `Altium STEP model serialization does not support board normal ${JSON.stringify(normalDirection)}`,
    )
  }
}

function getBoardThicknessMm(circuitJson: CircuitElement[]): number {
  const board = byType(circuitJson, "pcb_board")[0]
  return Math.max(asNumber(board?.thickness), 0)
}

function getCadComponentLayer(cadComponent: CircuitElement): "bottom" | "top" {
  return asString(cadComponent.layer).toLowerCase() === "bottom"
    ? "bottom"
    : "top"
}

function getBodyStandoffHeightMm({
  boardThicknessMm,
  layer,
  positionZMm,
  sizeZMm,
}: {
  boardThicknessMm: number
  layer: "bottom" | "top"
  positionZMm: number
  sizeZMm: number
}): number {
  const boardSurfaceZMm =
    layer === "bottom" ? -boardThicknessMm / 2 : boardThicknessMm / 2
  const outwardDistanceMm =
    layer === "bottom"
      ? boardSurfaceZMm - positionZMm
      : positionZMm - boardSurfaceZMm
  return outwardDistanceMm - sizeZMm / 2
}

function getModelPositionZMm({
  boardThicknessMm,
  layer,
  modelGlobalPositionZMm,
}: {
  boardThicknessMm: number
  layer: "bottom" | "top"
  modelGlobalPositionZMm: number
}): number {
  const boardSurfaceZMm =
    layer === "bottom" ? -boardThicknessMm / 2 : boardThicknessMm / 2
  return layer === "bottom"
    ? boardSurfaceZMm - modelGlobalPositionZMm
    : modelGlobalPositionZMm - boardSurfaceZMm
}

function getStepModel(cadComponent: CircuitElement): StepModel | undefined {
  const modelAsset = isCircuitElement(cadComponent.model_asset)
    ? cadComponent.model_asset
    : undefined
  const stepUrl = asString(cadComponent.model_step_url)
  const unsupportedModelUrl = [
    cadComponent.model_obj_url,
    cadComponent.model_stl_url,
    cadComponent.model_3mf_url,
    cadComponent.model_gltf_url,
    cadComponent.model_glb_url,
    cadComponent.model_wrl_url,
  ].some((url) => asString(url) !== "")
  if (!modelAsset && !stepUrl) {
    if (unsupportedModelUrl) {
      throw new Error("Altium component models must use the STEP format")
    }
    return undefined
  }

  const modelName =
    asString(modelAsset?.project_relative_path) ||
    getPathBasename(stepUrl) ||
    `${asString(cadComponent.cad_component_id, "component")}.step`
  if (
    !modelName.toLowerCase().endsWith(".step") &&
    !isStepMimeType(modelAsset)
  ) {
    throw new Error(
      `Altium component model ${JSON.stringify(modelName)} is not STEP`,
    )
  }

  const assetUrl = asString(modelAsset?.url, stepUrl)
  if (/^https?:\/\//iu.test(assetUrl)) {
    throw new Error(
      `Remote STEP model ${JSON.stringify(assetUrl)} must be provided as an embedded data URL`,
    )
  }
  return {
    ...(assetUrl.startsWith("data:") ? { bytes: decodeDataUrl(assetUrl) } : {}),
    name: modelName,
  }
}

function isStepMimeType(modelAsset: CircuitElement | undefined): boolean {
  const mimeType = asString(modelAsset?.mimetype).toLowerCase()
  return mimeType.includes("step") || mimeType.includes("stp")
}

function getPathBasename(path: string): string {
  const withoutQuery = path.split(/[?#]/u)[0] ?? ""
  return withoutQuery.split(/[\\/]/u).at(-1) ?? ""
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const separatorIndex = dataUrl.indexOf(",")
  if (separatorIndex < 0) throw new Error("Invalid STEP model data URL")
  const metadata = dataUrl.slice(0, separatorIndex)
  const encodedContent = dataUrl.slice(separatorIndex + 1)
  if (metadata.toLowerCase().endsWith(";base64")) {
    try {
      return Uint8Array.from(atob(encodedContent), (character) =>
        character.charCodeAt(0),
      )
    } catch {
      throw new Error("Invalid base64 STEP model data URL")
    }
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(encodedContent))
  } catch {
    throw new Error("Invalid percent-encoded STEP model data URL")
  }
}
