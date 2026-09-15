import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { expectOpenSourceSchematicRoundTrip } from "./fixtures/expect-open-source-schematic-round-trip"

test("round-trips the open-source SimpleFOC StepMini Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "simplefoc-stepmini.SchDoc",
    projectName: "SimpleFOC StepMini schematic",
  })

  // Make the native pin/wire T connection explicit to preserve its color.
  expectOpenSourceSchematicRoundTrip(result, { additionalNativeJunctions: 1 })
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
