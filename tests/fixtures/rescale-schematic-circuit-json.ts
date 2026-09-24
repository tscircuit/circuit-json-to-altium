import type { CircuitElement } from "../../lib/types"

/** Read exported schematics in the same Circuit JSON units as the source fixture. */
export function rescaleSchematicCircuitJson(
  elements: CircuitElement[],
  factor: number,
): CircuitElement[] {
  // Stroke fields in these import fixtures represent native width presets.
  const dimensions = new Set([
    "x",
    "x1",
    "x2",
    "y1",
    "y2",
    "y",
    "width",
    "height",
    "radius",
    "font_size",
    "distance_from_component_edge",
    "altium_secondary_radius",
  ])
  return elements.map((element) =>
    element.type?.startsWith("schematic_")
      ? JSON.parse(
          JSON.stringify(element, (key, value) =>
            dimensions.has(key) && typeof value === "number"
              ? Number((value * factor).toFixed(6))
              : value,
          ),
        )
      : element,
  )
}
