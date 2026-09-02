import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { expectOpenSourceSchematicRoundTrip } from "./fixtures/expect-open-source-schematic-round-trip"

test("round-trips the open-source PiDP-11 I/O Expander Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "pidp11-io-expander.SchDoc",
    projectName: "PiDP-11 I/O Expander schematic",
  })

  expectOpenSourceSchematicRoundTrip(result)
  expect(result.sourceCounts.schematic_graphic).toBe(3)
  expect(result.sourceTemplateAnnotationCount).toBeGreaterThan(0)
  expect(result.roundTripFilledSheetBackgroundIndices.length).toBeGreaterThan(0)
  expect(result.roundTripFirstComponentRecordIndex).toBeGreaterThan(0)
  expect(
    result.roundTripFilledSheetBackgroundIndices.every(
      (recordIndex) => recordIndex < result.roundTripFirstComponentRecordIndex,
    ),
  ).toBe(true)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
