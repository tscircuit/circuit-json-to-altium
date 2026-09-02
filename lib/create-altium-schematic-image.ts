import type { AltiumSchematicPngStorageInput } from "altiumts"
import {
  asNumber,
  asPoint,
  asString,
  isCircuitElement,
  sanitizeField,
  sanitizeFilename,
} from "./format"
import type { CircuitElement, PointTransform } from "./types"

export type CreatedAltiumSchematicImage = {
  embeddedPngImage: AltiumSchematicPngStorageInput
  recordFields: string[]
}

export function createAltiumSchematicImage({
  circuitToAltiumSchematicPoint,
  graphicIndex,
  schematicGraphic,
}: {
  circuitToAltiumSchematicPoint: PointTransform
  graphicIndex: number
  schematicGraphic: CircuitElement
}): CreatedAltiumSchematicImage | undefined {
  const center = asPoint(schematicGraphic.center)
  const width = asNumber(schematicGraphic.width)
  const height = asNumber(schematicGraphic.height)
  const pngDataUrl = getEmbeddedPngDataUrl(schematicGraphic)
  if (!center || width <= 0 || height <= 0 || !pngDataUrl) return undefined

  const filename = getEmbeddedImageFilename({
    graphicIndex,
    schematicGraphic,
  })
  const firstCorner = circuitToAltiumSchematicPoint({
    x: center.x - width / 2,
    y: center.y - height / 2,
  })
  const secondCorner = circuitToAltiumSchematicPoint({
    x: center.x + width / 2,
    y: center.y + height / 2,
  })
  return {
    embeddedPngImage: {
      name: filename,
      pngBytes: decodePngDataUrl({ filename, pngDataUrl }),
    },
    recordFields: [
      "RECORD=30",
      `FILENAME=${sanitizeField(filename)}`,
      "OWNERPARTID=-1",
      "EMBEDIMAGE=T",
      `LOCATION.X=${firstCorner.x}`,
      `LOCATION.Y=${firstCorner.y}`,
      `CORNER.X=${secondCorner.x}`,
      `CORNER.Y=${secondCorner.y}`,
      `KEEPASPECT=${schematicGraphic.keep_aspect_ratio === false ? "F" : "T"}`,
    ],
  }
}

function getEmbeddedPngDataUrl(
  schematicGraphic: CircuitElement,
): string | undefined {
  if (!isCircuitElement(schematicGraphic.asset)) return undefined
  const assetUrl = asString(schematicGraphic.asset.url)
  return assetUrl.startsWith("data:image/png;base64,") ? assetUrl : undefined
}

function getEmbeddedImageFilename({
  graphicIndex,
  schematicGraphic,
}: {
  graphicIndex: number
  schematicGraphic: CircuitElement
}): string {
  const assetPath = isCircuitElement(schematicGraphic.asset)
    ? asString(schematicGraphic.asset.project_relative_path)
    : ""
  const assetBasename = assetPath.replace(/\\/gu, "/").split("/").at(-1)
  const fallbackBasename = `${asString(schematicGraphic.schematic_graphic_id) || `schematic-graphic-${graphicIndex}`}.png`
  return sanitizeFilename(assetBasename || fallbackBasename)
}

function decodePngDataUrl({
  filename,
  pngDataUrl,
}: {
  filename: string
  pngDataUrl: string
}): Uint8Array {
  const base64Payload = pngDataUrl.slice("data:image/png;base64,".length)
  try {
    return Uint8Array.from(atob(base64Payload), (character) =>
      character.charCodeAt(0),
    )
  } catch {
    throw new Error(
      `Schematic graphic ${JSON.stringify(filename)} has an invalid PNG data URL`,
    )
  }
}
