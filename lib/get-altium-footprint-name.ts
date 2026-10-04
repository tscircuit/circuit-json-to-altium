import {
  asNumber,
  asPositiveNumber,
  asString,
  byType,
  formatNumber,
  isCircuitElement,
  sanitizeField,
} from "./format"
import type { CircuitElement } from "./types"

/**
 * Stable Altium footprint (PATTERN / implementation MODELNAME) for a PCB
 * component. Both the PcbDoc component and the SchDoc implementation link use
 * this name, so Altium can match them.
 *
 * Prefers the footprint identity from Circuit JSON (footprinter string, then
 * supplier/manufacturer part) over the placed bounding box, which changes
 * with rotation and gave the same footprint several names.
 */
export function createAltiumFootprintNameLookup(
  circuitJson: CircuitElement[],
): (pcbComponent: CircuitElement) => string {
  const sourceComponents = new Map(
    byType(circuitJson, "source_component").map((element) => [
      asString(element.source_component_id),
      element,
    ]),
  )
  const cadComponents = new Map(
    byType(circuitJson, "cad_component").map((element) => [
      asString(element.pcb_component_id),
      element,
    ]),
  )
  return (pcbComponent) => {
    const cadComponent = cadComponents.get(
      asString(pcbComponent.pcb_component_id),
    )
    const sourceComponent = sourceComponents.get(
      asString(pcbComponent.source_component_id),
    )
    const footprinterString = sanitizePatternName(
      cadComponent?.footprinter_string,
    )
    if (footprinterString) return footprinterString
    const supplierPartNumbers = isCircuitElement(
      sourceComponent?.supplier_part_numbers,
    )
      ? sourceComponent.supplier_part_numbers
      : {}
    for (const [supplier, partNumbers] of Object.entries(supplierPartNumbers)) {
      const partNumber = Array.isArray(partNumbers)
        ? sanitizePatternName(partNumbers[0])
        : ""
      if (partNumber) return `${supplier.toUpperCase()}-${partNumber}`
    }
    const manufacturerPartNumber = sanitizePatternName(
      sourceComponent?.manufacturer_part_number,
    )
    if (manufacturerPartNumber) return manufacturerPartNumber
    // Fall back to the unrotated footprint size so rotated copies of the same
    // footprint keep one name.
    const isQuarterTurn = Math.abs(asNumber(pcbComponent.rotation)) % 180 === 90
    const width = asPositiveNumber(pcbComponent.width, 1)
    const height = asPositiveNumber(pcbComponent.height, 1)
    const [unrotatedWidth, unrotatedHeight] = isQuarterTurn
      ? [height, width]
      : [width, height]
    return `TSCIRCUIT-${formatNumber(unrotatedWidth)}x${formatNumber(unrotatedHeight)}mm`
  }
}

function sanitizePatternName(value: unknown): string {
  // Altium pattern names are plain strings; keep them short and free of the
  // record delimiters handled by sanitizeField.
  return sanitizeField(typeof value === "string" ? value.trim() : "").slice(
    0,
    255,
  )
}
