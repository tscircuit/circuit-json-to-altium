import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { expectOpenSourceSchematicRoundTrip } from "./fixtures/expect-open-source-schematic-round-trip"

test("round-trips the open-source quadcopter controller Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "quadcopter-controller.SchDoc",
    projectName: "Quadcopter Controller schematic",
  })

  expectOpenSourceSchematicRoundTrip(result)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
