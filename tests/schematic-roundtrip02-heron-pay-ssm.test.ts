import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("round-trips the open-source HERON PAY-SSM Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "heron-pay-ssm-top.SchDoc",
    projectName: "HERON PAY-SSM schematic",
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
  const sourceSheetText = result.sourceAnnotationSignatures.flatMap(
    (annotation) =>
      annotation.type === "schematic_text" ? [annotation.text] : [],
  )
  expect(sourceSheetText).toContain("v4.3")
  expect(sourceSheetText).toContain("Lorna Lan, Dylan Vogel")
  expect(sourceSheetText).not.toContain("=REVISION")
  expect(sourceSheetText).not.toContain("=DrawnBy")
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
  expect(result.roundTripSheetSignatures).toEqual(result.sourceSheetSignatures)
  expect(result.geometryMaxDeltaCircuitUnits).toBeLessThan(0.06)
  expect(result.componentSizeMaxDeltaCircuitUnits).toBeLessThan(0.06)
  expect(result.sourceCounts.off_sheet_port).toBe(94)
  expect(result.sourceSheetSignatures).toHaveLength(17)
  expect(result.sourceCounts.do_not_connect).toBe(0)
  expect(result.sourceCounts.power_port).toBe(28)
  expect(result.sourceSymbolPrimitiveCounts.total).toBe(36)
  expect({
    path: result.sourceCounts.schematic_path,
    rect: result.sourceCounts.schematic_rect,
    text: result.sourceCounts.schematic_text,
  }).toEqual({ path: 0, rect: 9, text: 386 })
  expect(result.sourceSupportedPrimitiveTotal).toBeGreaterThan(300)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
