type SvgSize = {
  height: number
  width: number
}

function readSvgSize(svg: string): SvgSize {
  const rootTag = svg.match(/<svg\b[^>]*>/u)?.[0]
  if (!rootTag) throw new Error("Expected an SVG root element")

  const width = Number(rootTag.match(/\bwidth=["']([\d.]+)["']/u)?.[1])
  const height = Number(rootTag.match(/\bheight=["']([\d.]+)["']/u)?.[1])
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Expected positive numeric SVG width and height")
  }

  return { height, width }
}

function toSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

export function createSideBySideSvg(
  sourceSvg: string,
  roundTripSvg: string,
  labels?: { source: string; converted: string },
): string {
  const sourceSize = readSvgSize(sourceSvg)
  const roundTripSize = readSvgSize(roundTripSvg)
  const width = sourceSize.width + roundTripSize.width
  const labelHeight = labels ? 32 : 0
  const height = Math.max(sourceSize.height, roundTripSize.height) + labelHeight
  const escapeText = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
  const captions = labels
    ? `<rect width="${width}" height="${labelHeight}" fill="#f1f5f9"/>
  <text x="12" y="21" font-family="Arial, sans-serif" font-size="14" fill="#334155">${escapeText(labels.source)}</text>
  <text x="${sourceSize.width + 12}" y="21" font-family="Arial, sans-serif" font-size="14" fill="#334155">${escapeText(labels.converted)}</text>`
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${captions ? `  ${captions}\n` : ""}  <image x="0" y="${labelHeight}" width="${sourceSize.width}" height="${sourceSize.height}" href="${toSvgDataUrl(sourceSvg)}"/>
  <image x="${sourceSize.width}" y="${labelHeight}" width="${roundTripSize.width}" height="${roundTripSize.height}" href="${toSvgDataUrl(roundTripSvg)}"/>
</svg>`
}
