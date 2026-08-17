type SvgDocument = {
  contents: string
  viewBox: string
}

type CreateComparisonSvgParams = {
  altiumLabel: string
  altiumSvg: string
  circuitJsonSvg: string
}

function getSvgDocument(svg: string): SvgDocument {
  const openingTag = svg.match(/<svg\b([^>]*)>/u)
  if (!openingTag || openingTag.index === undefined) {
    throw new Error("Snapshot source does not contain an SVG root")
  }
  const closingTagIndex = svg.lastIndexOf("</svg>")
  if (closingTagIndex < openingTag.index) {
    throw new Error("Snapshot source has an incomplete SVG root")
  }

  const attributes = openingTag[1] ?? ""
  const viewBoxMatch = attributes.match(/\bviewBox=["']([^"']+)["']/u)
  const widthMatch = attributes.match(/\bwidth=["']([\d.]+)/u)
  const heightMatch = attributes.match(/\bheight=["']([\d.]+)/u)
  const width = widthMatch?.[1] ?? "1000"
  const height = heightMatch?.[1] ?? "700"
  const contents = svg
    .slice(openingTag.index + openingTag[0].length, closingTagIndex)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
  return {
    contents,
    viewBox: viewBoxMatch?.[1] ?? `0 0 ${width} ${height}`,
  }
}

export function createCircuitJsonAltiumComparisonSvg({
  altiumLabel,
  altiumSvg,
  circuitJsonSvg,
}: CreateComparisonSvgParams): string {
  const circuitJsonDocument = getSvgDocument(circuitJsonSvg)
  const altiumDocument = getSvgDocument(altiumSvg)
  const panelWidth = 760
  const panelHeight = 620
  const outerPadding = 24
  const panelGap = 24
  const labelHeight = 52
  const canvasWidth = outerPadding * 2 + panelWidth * 2 + panelGap
  const canvasHeight = outerPadding * 2 + labelHeight + panelHeight
  const rightPanelX = outerPadding + panelWidth + panelGap
  const panelY = outerPadding + labelHeight

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <rect width="${canvasWidth}" height="${canvasHeight}" fill="#f5f7fa"/>
  <rect x="${outerPadding}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="8" fill="white" stroke="#cbd5e1"/>
  <rect x="${rightPanelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="8" fill="white" stroke="#cbd5e1"/>
  <text x="${outerPadding}" y="${outerPadding + 30}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#0f172a">Circuit JSON</text>
  <text x="${rightPanelX}" y="${outerPadding + 30}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#0f172a">${altiumLabel}</text>
  <svg x="${outerPadding + 12}" y="${panelY + 12}" width="${panelWidth - 24}" height="${panelHeight - 24}" viewBox="${circuitJsonDocument.viewBox}" preserveAspectRatio="xMidYMid meet">
    ${circuitJsonDocument.contents}
  </svg>
  <svg x="${rightPanelX + 12}" y="${panelY + 12}" width="${panelWidth - 24}" height="${panelHeight - 24}" viewBox="${altiumDocument.viewBox}" preserveAspectRatio="xMidYMid meet">
    ${altiumDocument.contents}
  </svg>
</svg>`
}
