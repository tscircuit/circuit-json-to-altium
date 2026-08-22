import { type AltiumRecord, altiumColorToRgb } from "altiumts"

export function getCssColorFromAltiumRecord({
  fallbackCssColor,
  fieldNames,
  record,
}: {
  fallbackCssColor: string
  fieldNames: string[]
  record: AltiumRecord
}): string {
  const altiumColor = fieldNames.reduce<number | undefined>(
    (resolvedColor, fieldName) => resolvedColor ?? record.getNumber(fieldName),
    undefined,
  )
  if (altiumColor === undefined) return fallbackCssColor
  const { blue, green, red } = altiumColorToRgb(altiumColor)
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`
}
