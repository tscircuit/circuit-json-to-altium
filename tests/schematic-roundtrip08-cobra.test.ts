import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { expectOpenSourceSchematicRoundTrip } from "./fixtures/expect-open-source-schematic-round-trip"

const sheets = [
  { filename: "cobra-ch341.SchDoc", snapshotName: "ch341" },
  { filename: "cobra-m3406.SchDoc", snapshotName: "m3406" },
  { filename: "cobra-mlx90640.SchDoc", snapshotName: "mlx90640" },
  { filename: "cobra-type-c.SchDoc", snapshotName: "type-c" },
]

test("round-trips every sheet of the open-source Cobra Altium schematic", async () => {
  const results = await Promise.all(
    sheets.map(({ filename }) =>
      createOpenSourceSchematicRoundTrip({
        filename,
        projectName: `Cobra ${filename} schematic`,
      }),
    ),
  )

  for (const result of results) {
    expectOpenSourceSchematicRoundTrip(result, {
      offSheetPortFontSizeTolerancePoints: 1,
    })
  }
  const componentTexts = results.flatMap((result) =>
    result.sourceComponentTextSignatures.map(({ text }) => text),
  )
  expect(componentTexts.filter((text) => /^=(?:GPN|MPN)$/u.test(text))).toEqual(
    [],
  )
  expect(componentTexts).toEqual(
    expect.arrayContaining(["CH341C", "M3406", "MLX90640", "USB-TYPE-C-018"]),
  )
  await expect(
    results.map((result) =>
      createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
    ),
  ).toMatchMultipleSvgSnapshots(
    import.meta.path,
    sheets.map(({ snapshotName }) => snapshotName),
  )
})
