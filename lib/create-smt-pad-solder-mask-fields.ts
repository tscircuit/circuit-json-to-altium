import { formatMil, MILLIMETERS_TO_MILS } from "./format"
import type { CircuitElement } from "./types"

export function createSmtPadSolderMaskFields(
  pad: CircuitElement,
  layer: "TOP" | "BOTTOM",
): string[] {
  const fields: string[] = []
  if (pad.is_covered_with_solder_mask === true) {
    fields.push(`TENTED${layer}=TRUE`)
  }
  const margin = pad.soldermask_margin
  if (typeof margin === "number" && Number.isFinite(margin)) {
    fields.push(
      "SOLDERMASKEXPANSIONMODE=Manual",
      `SOLDERMASKEXPANSION_MANUAL=${formatMil(margin * MILLIMETERS_TO_MILS)}`,
    )
  }
  return fields
}
