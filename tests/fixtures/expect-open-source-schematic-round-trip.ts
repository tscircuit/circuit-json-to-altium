import { expect } from "bun:test"
import type { OpenSourceSchematicRoundTrip } from "./create-open-source-schematic-round-trip"

export function expectOpenSourceSchematicRoundTrip(
  result: OpenSourceSchematicRoundTrip,
  {
    offSheetPortFontSizeTolerancePoints = 0,
  }: { offSheetPortFontSizeTolerancePoints?: number } = {},
): void {
  expect(result.roundTripCounts).toEqual(result.sourceCounts)
  expect(result.roundTripComponentNames).toEqual(result.sourceComponentNames)
  expect(result.roundTripSymbolPrimitiveCounts).toEqual(
    result.sourceSymbolPrimitiveCounts,
  )
  expect(result.roundTripPortNames).toEqual(result.sourcePortNames)
  expect(result.roundTripNetLabelTexts).toEqual(result.sourceNetLabelTexts)
  expect(result.roundTripAnnotationSignatures).toEqual(
    result.sourceAnnotationSignatures,
  )
  expect(result.roundTripComponentTextSignatures).toEqual(
    result.sourceComponentTextSignatures,
  )
  expect(result.roundTripOffSheetPortSignatures).toEqual(
    result.sourceOffSheetPortSignatures,
  )
  expect(result.roundTripOffSheetPortFontSizePoints).toHaveLength(
    result.sourceOffSheetPortFontSizePoints.length,
  )
  for (const [
    index,
    sourceFontSize,
  ] of result.sourceOffSheetPortFontSizePoints.entries()) {
    expect(
      Math.abs(
        result.roundTripOffSheetPortFontSizePoints[index]! - sourceFontSize,
      ),
    ).toBeLessThanOrEqual(offSheetPortFontSizeTolerancePoints)
  }
  expect(result.roundTripPowerPortSymbolNames).toEqual(
    result.sourcePowerPortSymbolNames,
  )
  expect(result.roundTripSheetSignatures).toEqual(result.sourceSheetSignatures)
  expect(result.geometryMaxDeltaCircuitUnits).toBeLessThan(0.06)
  expect(result.componentSizeMaxDeltaCircuitUnits).toBeLessThan(0.06)
  expect(result.sourceSupportedPrimitiveTotal).toBeGreaterThan(0)
}
