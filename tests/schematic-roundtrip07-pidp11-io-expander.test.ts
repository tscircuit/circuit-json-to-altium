import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { expectOpenSourceSchematicRoundTrip } from "./fixtures/expect-open-source-schematic-round-trip"

test("round-trips the open-source PiDP-11 I/O Expander Altium schematic", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "pidp11-io-expander.SchDoc",
    projectName: "PiDP-11 I/O Expander schematic",
    sourceProject: {
      currentDate: "2026-09-08",
      currentTime: "14:30",
      documentName: "PiDP11IOExpander.SchDoc",
      filename: "pidp11-io-expander.PrjPcb",
      projectName: "PCB-PiDP11IOExpander.PrjPcb",
    },
  })

  expectOpenSourceSchematicRoundTrip(result)
  for (const svg of [result.sourceSvg, result.roundTripSvg]) {
    expect(svg).toContain(">PiDP-11 I/O Expander</text>")
    expect(svg).toContain(">2026-09-08</text>")
    expect(svg).toContain(">14:30</text>")
    expect(svg).not.toContain(">=ProjectTitle</text>")
    expect(svg).not.toContain(">=CurrentDate</text>")
    expect(svg).not.toContain(">=CurrentTime</text>")
  }
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
  expect(result.roundTripTemplateRecordCount).toBe(1)
  expect(result.roundTripTemplateOwnedRecordCount).toBe(28)
  expect(result.roundTripEmbeddedImageCount).toBe(3)
  expect(result.sourceImageRecordCount).toBe(4)
  expect(result.roundTripImageRecordCount).toBe(result.sourceImageRecordCount)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
