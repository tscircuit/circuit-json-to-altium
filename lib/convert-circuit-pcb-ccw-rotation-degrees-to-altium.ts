export function convertCircuitPcbCcwRotationDegreesToAltium(
  ccwRotationDegrees: number,
): number {
  const normalizedCcwRotationDegrees = ((ccwRotationDegrees % 360) + 360) % 360
  return normalizedCcwRotationDegrees === 0 ? 0 : normalizedCcwRotationDegrees
}
