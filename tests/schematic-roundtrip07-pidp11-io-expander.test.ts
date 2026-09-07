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
  expect(
    result.sourceAnnotationSignatures.some(
      (annotation) =>
        annotation.type === "schematic_text" &&
        annotation.text.startsWith("Single board operation is assumed by"),
    ),
  ).toBe(true)
  expect(
    result.sourceAnnotationSignatures.some(
      (annotation) =>
        annotation.type === "schematic_rect" &&
        annotation.isFilled &&
        annotation.fillColor === "#ffff96",
    ),
  ).toBe(true)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
