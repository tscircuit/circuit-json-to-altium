import { expect, test } from "bun:test"
import { createOpenSourceSchematicRoundTrip } from "./fixtures/create-open-source-schematic-round-trip"

function createEmbeddedImageComparisonSvg({
  roundTripImageDataUrl,
  sourceImageDataUrl,
}: {
  roundTripImageDataUrl: string
  sourceImageDataUrl: string
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <image x="0" y="0" width="320" height="320" href="${sourceImageDataUrl}"/>
  <image x="320" y="0" width="320" height="320" href="${roundTripImageDataUrl}"/>
</svg>`
}

test("preserves the embedded NodeMCU schematic image", async () => {
  const result = await createOpenSourceSchematicRoundTrip({
    filename: "nodemcu-esp12.SchDoc",
    projectName: "NodeMCU embedded schematic image",
  })

  expect(result.roundTripEmbeddedImagePngSha256).toEqual(
    result.sourceEmbeddedImagePngSha256,
  )
  expect(result.sourceEmbeddedImagePngSha256).toHaveLength(1)
  if (
    !result.sourceEmbeddedImageDataUrl ||
    !result.roundTripEmbeddedImageDataUrl
  ) {
    throw new Error("Expected source and round-trip embedded image data URLs")
  }
  await expect(
    createEmbeddedImageComparisonSvg({
      roundTripImageDataUrl: result.roundTripEmbeddedImageDataUrl,
      sourceImageDataUrl: result.sourceEmbeddedImageDataUrl,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
