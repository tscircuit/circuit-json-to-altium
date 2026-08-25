import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("round-trips the open-source NodeMCU ESP-12 Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "nodemcu-esp12.SchDoc",
    projectName: "NodeMCU ESP-12 schematic",
  })

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
  expect(result.roundTripOffSheetPortFontSizePoints).toEqual(
    result.sourceOffSheetPortFontSizePoints,
  )
  expect(result.roundTripPowerPortSymbolNames).toEqual(
    result.sourcePowerPortSymbolNames,
  )
  expect(result.geometryMaxDeltaCircuitUnits).toBeLessThan(0.06)
  expect(result.componentSizeMaxDeltaCircuitUnits).toBeLessThan(0.06)
  expect(result.sourceCounts.off_sheet_port).toBe(0)
  expect(result.sourceCounts.do_not_connect).toBe(6)
  expect(result.sourceCounts.power_port).toBe(37)
  expect(result.sourceSymbolPrimitiveCounts.total).toBe(156)
  expect({
    path: result.sourceCounts.schematic_path,
    rect: result.sourceCounts.schematic_rect,
    text: result.sourceCounts.schematic_text,
  }).toEqual({ path: 17, rect: 3, text: 384 })
  expect(result.sourceSupportedPrimitiveTotal).toBeGreaterThan(300)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
