import type { AltiumTextRecord } from "altiumts"
import { pcb_silkscreen_text } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

// altiumts 0.0.95 does not draw INVERTED text. Project only the parsed native
// label fields through circuit-to-svg to visualize inversion and border margin.
// Its stroke-font glyphs are a style preview, not an Altium Designer screenshot.
export function renderAltiumKnockoutLabels(labels: AltiumTextRecord[]): string {
  const projectedLabels = labels.map((label, index) => {
    const margin =
      label.getAltiumMeasurement("MARGINBORDERWIDTH")?.toMillimeters() ?? 0
    return pcb_silkscreen_text.parse({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: `native-label-${index}`,
      pcb_component_id: "native-label-preview",
      text: label.text,
      anchor_position: {
        x: label.getAltiumMeasurement("X")!.toMillimeters(),
        y: label.getAltiumMeasurement("Y")!.toMillimeters(),
      },
      anchor_alignment: "center",
      font_size: label.getAltiumMeasurement("HEIGHT")!.toMillimeters(),
      layer: "top",
      ccw_rotation: -label.rotation,
      is_mirrored: label.mirrored === true,
      is_knockout: label.inverted === true,
      knockout_padding: {
        left: margin,
        right: margin,
        top: margin,
        bottom: margin,
      },
    })
  })
  const xs = projectedLabels.map((label) => label.anchor_position.x)
  const ys = projectedLabels.map((label) => label.anchor_position.y)
  return convertCircuitJsonToPcbSvg(projectedLabels, {
    width: 1000,
    height: 400,
    includeVersion: false,
    backgroundColor: "#071c15",
    colorOverrides: { boardOutline: "transparent" },
    viewport: {
      minX: Math.min(...xs) - 5,
      maxX: Math.max(...xs) + 5,
      minY: Math.min(...ys) - 3,
      maxY: Math.max(...ys) + 3,
    },
  })
}
