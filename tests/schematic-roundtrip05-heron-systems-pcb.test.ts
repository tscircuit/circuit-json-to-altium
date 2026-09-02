import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

function createComponentMetadataSummarySvg({
  roundTripCount,
  sourceCount,
}: {
  roundTripCount: number
  sourceCount: number
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="150" viewBox="0 0 500 150">
  <rect width="500" height="150" fill="rgb(245, 241, 237)"/>
  <text x="20" y="30" font-family="Arial" font-size="18" font-weight="bold">Full HERON systems schematic</text>
  <text x="20" y="55" font-family="Arial" font-size="15">Components with real part metadata</text>
  <text x="20" y="83" font-family="Arial" font-size="14">source</text>
  <rect x="120" y="70" width="${sourceCount * 20}" height="16" fill="#356cb6"/>
  <text x="20" y="115" font-family="Arial" font-size="14">round trip</text>
  <rect x="120" y="102" width="${roundTripCount * 20}" height="16" fill="#b65835"/>
</svg>`
}

test("round-trips the open-source HERON systems PCB Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "heron-systems-pcb.SchDoc",
    projectName: "HERON systems PCB schematic",
    sourceProject: {
      documentName: "systems_pcb.SchDoc",
      filename: "heron-systems-pcb.PrjPCB",
      projectName: "systems_pcb.PrjPCB",
    },
  })

  expect(result.roundTripCounts).toEqual(result.sourceCounts)
  expect(result.roundTripComponentNames).toEqual(result.sourceComponentNames)
  expect(result.roundTripComponentPartSignatures).toEqual(
    result.sourceComponentPartSignatures,
  )
  expect(result.sourceComponentPartSignatures).toHaveLength(8)
  expect(result.roundTripComponentPartSignatures).toHaveLength(8)
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
  expect(sourceSheetText).toContain("1")
  expect(sourceSheetText).toContain("5")
  expect(sourceSheetText).toContain("systems_pcb.SchDoc")
  expect(sourceSheetText).toContain("v3.3")
  expect(sourceSheetText).toContain("Bruno Almeida")
  expect(sourceSheetText).not.toContain("=DocumentName")
  expect(sourceSheetText).not.toContain("=ProjectRevision")
  expect(sourceSheetText).not.toContain("=ProjectDrawnBy")
  expect(sourceSheetText).not.toContain("=SheetNumber")
  expect(sourceSheetText).not.toContain("=SheetTotal")
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
  expect(result.sourceCounts.off_sheet_port).toBe(34)
  expect(result.sourceSheetSignatures).toHaveLength(7)
  expect(result.sourceCounts.do_not_connect).toBe(10)
  expect(result.sourceCounts.power_port).toBe(38)
  expect(result.sourceSymbolPrimitiveCounts.total).toBe(102)
  expect({
    path: result.sourceCounts.schematic_path,
    rect: result.sourceCounts.schematic_rect,
    text: result.sourceCounts.schematic_text,
  }).toEqual({ path: 0, rect: 9, text: 420 })
  expect(result.sourceSupportedPrimitiveTotal).toBeGreaterThan(300)
  await expect(
    createSideBySideSvg(
      createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
      createComponentMetadataSummarySvg({
        roundTripCount: result.roundTripComponentPartSignatures.length,
        sourceCount: result.sourceComponentPartSignatures.length,
      }),
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
