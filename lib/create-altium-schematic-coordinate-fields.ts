/** SchDoc coordinates use signed integer base and hundred-thousandth fields. */
export function createAltiumSchematicCoordinateFields(
  fieldName: string,
  coordinateValue: number,
): string[] {
  const ticks = Math.round(coordinateValue * 100_000)
  if (!Number.isSafeInteger(ticks)) {
    throw new RangeError(
      `Invalid schematic coordinate ${fieldName}: ${coordinateValue}`,
    )
  }
  const integer = Math.trunc(ticks / 100_000)
  const fraction = ticks - integer * 100_000
  return [
    `${fieldName}=${integer}`,
    ...(fraction === 0
      ? []
      : [
          `${fieldName}_FRAC=${fraction < 0 ? "-" : ""}${String(Math.abs(fraction)).padStart(5, "0")}`,
        ]),
  ]
}
