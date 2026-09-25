import {
  type AltiumSchDoc,
  type AltiumSheetSvgOptions,
  serializeAltiumSheetToSvg,
} from "altiumts"

type Crop = { x: number; y: number; width: number; height: number }

/** Render a generated sheet's top-left crop at its final output resolution. */
export function renderAltiumSchematicCrop(
  source: AltiumSchDoc,
  crop: Crop,
  options: Pick<AltiumSheetSvgOptions, "width" | "height">,
): string {
  const sheetHeight = source.getRecordsByKind("31")[0]?.getNumber("CUSTOMY")
  if (sheetHeight === undefined)
    throw new Error("Expected a generated custom sheet")
  return serializeAltiumSheetToSvg(source, {
    ...options,
    margin: 0,
    showBorder: false,
    // The renderer's viewBox uses native bottom-left coordinates. Supplying
    // it before rendering also sizes device hairlines for the cropped image.
    viewBox: {
      ...crop,
      y: sheetHeight - crop.y - crop.height,
    },
  })
}
