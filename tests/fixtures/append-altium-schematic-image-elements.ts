import type { AltiumSchDoc } from "altiumts"
import type { CircuitElement } from "../../lib/types"
import {
  getRecordCorner,
  getRecordLocation,
  toCircuitLength,
  toCircuitPoint,
} from "./altium-schematic-coordinate-utils"

export function appendAltiumSchematicImageElements({
  document,
  elements,
}: {
  document: AltiumSchDoc
  elements: CircuitElement[]
}): void {
  for (const [imageIndex, embeddedImage] of document.embeddedImages.entries()) {
    const firstCorner = getRecordLocation(embeddedImage.record)
    const secondCorner = getRecordCorner(embeddedImage.record)
    const width = toCircuitLength(Math.abs(secondCorner.x - firstCorner.x))
    const height = toCircuitLength(Math.abs(secondCorner.y - firstCorner.y))
    if (width <= 0 || height <= 0) continue

    elements.push({
      type: "schematic_graphic",
      schematic_graphic_id: `schematic_graphic_${imageIndex}`,
      asset: {
        project_relative_path:
          embeddedImage.record.fileName || embeddedImage.name,
        url: embeddedImage.getDataUrl(),
        mimetype: "image/png",
      },
      center: toCircuitPoint({
        x: (firstCorner.x + secondCorner.x) / 2,
        y: (firstCorner.y + secondCorner.y) / 2,
      }),
      width,
      height,
      keep_aspect_ratio:
        embeddedImage.record.getBoolean("KEEPASPECT") !== false,
    })
  }
}
