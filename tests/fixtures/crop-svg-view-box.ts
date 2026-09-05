type SvgViewBox = {
  x: number
  y: number
  width: number
  height: number
}

const ROOT_SVG_PATTERN = /<svg\b[^>]*>/u
const VIEW_BOX_PATTERN = /\bviewBox=["'][^"']+["']/u
const FULL_VIEWPORT_BACKGROUND_PATTERN =
  /<rect\b(?=[^>]*\bwidth=["']100%["'])(?=[^>]*\bheight=["']100%["'])[^>]*\/>/u
const FILL_PATTERN = /\bfill=["']([^"']+)["']/u

/**
 * Crop an SVG while preserving an opaque background for the cropped region.
 * Percentage-sized SVG backgrounds start at the original origin, so changing
 * only the viewBox can otherwise leave the crop transparent.
 */
export function cropSvgViewBox(svg: string, viewBox: SvgViewBox): string {
  const rootTag = svg.match(ROOT_SVG_PATTERN)?.[0]
  if (!rootTag || !VIEW_BOX_PATTERN.test(rootTag)) {
    throw new Error("Expected an SVG root with a viewBox")
  }

  const backgroundTag = svg.match(FULL_VIEWPORT_BACKGROUND_PATTERN)?.[0]
  const backgroundFill = backgroundTag?.match(FILL_PATTERN)?.[1]
  const croppedRootTag = rootTag.replace(
    VIEW_BOX_PATTERN,
    `viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"`,
  )

  let croppedSvg = svg.replace(rootTag, croppedRootTag)
  if (!backgroundTag || !backgroundFill) return croppedSvg

  croppedSvg = croppedSvg.replace(backgroundTag, "")
  const cropBackground = `<rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="${backgroundFill}"/>`
  return croppedSvg.replace(
    croppedRootTag,
    `${croppedRootTag}\n  ${cropBackground}`,
  )
}
