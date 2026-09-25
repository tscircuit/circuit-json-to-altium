import type { AltiumSchDoc } from "altiumts"
import { DEFAULT_SCHEMATIC_UNITS_PER_CIRCUIT_UNIT } from "../../lib/schematic-scale"
import { renderAltiumSchematicCrop } from "./render-altium-schematic-crop"

type DetailViewBox = Parameters<typeof renderAltiumSchematicCrop>[1]

const COMPARISON_WIDTH = 1100
const COMPARISON_HEIGHT = 600

export function renderAltiumSchematicDetail(
  source: AltiumSchDoc,
  viewBox: DetailViewBox,
): string {
  return renderAltiumSchematicCrop(
    source,
    Object.fromEntries(
      Object.entries(viewBox).map(([key, value]) => [
        key,
        (value * DEFAULT_SCHEMATIC_UNITS_PER_CIRCUIT_UNIT) / 20,
      ]),
    ) as DetailViewBox,
    { width: COMPARISON_WIDTH, height: COMPARISON_HEIGHT },
  )
}
