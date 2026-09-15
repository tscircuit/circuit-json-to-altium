import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { expectOpenSourceSchematicRoundTrip } from "./fixtures/expect-open-source-schematic-round-trip"

test("round-trips the open-source CH582 Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "ch582.SchDoc",
    projectName: "CH582 schematic",
  })

  // Make the native pin/wire T connection explicit to preserve its color.
  expectOpenSourceSchematicRoundTrip(result, { additionalNativeJunctions: 1 })
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
