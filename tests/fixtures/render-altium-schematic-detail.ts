import { serializeAltiumSheetToSvg } from "altiumts"
import { cropSvgViewBox } from "./crop-svg-view-box"

type SchematicSource = Parameters<typeof serializeAltiumSheetToSvg>[0]
type DetailViewBox = Parameters<typeof cropSvgViewBox>[1]

const COMPARISON_WIDTH = 1100
const COMPARISON_HEIGHT = 600

export function renderAltiumSchematicDetail(
  source: SchematicSource,
  viewBox: DetailViewBox,
): string {
  return cropSvgViewBox(
    serializeAltiumSheetToSvg(source, {
      height: COMPARISON_HEIGHT,
      margin: 0,
      showBorder: false,
      width: COMPARISON_WIDTH,
    }),
    viewBox,
  )
}
