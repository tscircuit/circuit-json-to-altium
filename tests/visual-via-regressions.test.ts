import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { board, extractArchive } from "./fixtures"
import { viaRegressionCases } from "./fixtures/via-regressions"

const layers = ["TOP", "MID-LAYER1", "MID-LAYER2", "BOTTOM"]
const escapeText = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

// A top-down PCB image cannot show a via's start/stop layers or net membership.
// This diagnostic cross-section reads those fields from the parsed binary output.
// Layer spacing is illustrative; it does not assert the exported board stackup.
function crossSection(span: string[], net: string, color: string): string {
  const start = layers.indexOf(span[0] ?? "")
  const end = layers.indexOf(span[1] ?? "")
  return `${layers.map((layer, index) => `<line x1="6" x2="170" y1="${index * 30}" y2="${index * 30}" stroke="#94a3b8"/><text x="6" y="${index * 30 - 6}" font-size="10" fill="#475569">${layer}</text>`).join("")}
    ${start >= 0 && end >= 0 ? `<rect x="124" y="${start * 30 - 4}" width="22" height="${(end - start) * 30 + 8}" rx="3" fill="${color}"/><rect x="132" y="${start * 30 - 4}" width="6" height="${(end - start) * 30 + 8}" fill="#f8fafc"/>` : '<text x="90" y="55" font-size="12" fill="#b91c1c">NO VIA</text>'}
    <text x="6" y="122" font-size="13" fill="${color}">Net: ${escapeText(net)}</text>`
}

test("visually audits via spans, nets, and inline presence in native output", async () => {
  const panels: string[] = []
  for (const [index, fixture] of viaRegressionCases.entries()) {
    const { pcb } = await extractArchive([
      board({ num_layers: 4, width: 6, height: 6 }),
      { type: "source_net", source_net_id: "gnd", name: "GND" },
      ...fixture.elements,
    ])
    const vias = pcb.getRecordsByKind("Via")
    const via = vias[0]
    const span = via
      ? [via.get("STARTLAYER") ?? "", via.get("ENDLAYER") ?? ""]
      : []
    const net = via ? (pcb.getNetForRecord(via)?.name ?? "UNASSIGNED") : "NONE"
    const correct =
      vias.length === 1 &&
      net === "GND" &&
      span.every((layer, i) => layer === fixture.layers[i])
    const actualSvg = serializeAltiumPcbToSvg(pcb, { width: 360, height: 260 })
    panels.push(`<g transform="translate(${index * 400}, 0)">
      <rect x="8" y="50" width="384" height="550" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
      <text x="24" y="80" font-size="19" font-weight="bold">${escapeText(fixture.name)}</text>
      <text x="24" y="108" font-size="13">Expected from input</text>
      <text x="212" y="108" font-size="13">Parsed binary output</text>
      <g transform="translate(20, 142)">${crossSection(fixture.layers, "GND", "#15803d")}</g>
      <g transform="translate(208, 142)">${crossSection(span, net, correct ? "#15803d" : "#b91c1c")}</g>
      <text x="24" y="300" font-size="14" fill="${correct ? "#15803d" : "#b91c1c"}">Exported vias: ${vias.length} (expected 1)</text>
      <text x="24" y="324" font-size="13">Top-down exported PCB (altiumts renderer)</text>
      <image x="20" y="332" width="360" height="260" href="data:image/svg+xml;base64,${Buffer.from(actualSvg).toString("base64")}"/>
    </g>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650">
    <rect width="1200" height="650" fill="white"/>
    <g font-family="Arial, sans-serif" fill="#0f172a">
      <text x="24" y="30" font-size="22" font-weight="bold">Via conversion audit: expected input vs native binary output</text>
      ${panels.join("\n")}
      <text x="24" y="625" font-size="13">Cross-sections illustrate via endpoints and nets, not physical stackup. PCB views are rendered by altiumts, not Altium Designer.</text>
    </g>
  </svg>`
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
