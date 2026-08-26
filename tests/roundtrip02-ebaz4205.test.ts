import { expect, test } from "bun:test"
import { createOpenSourceBoardRoundTrip } from "./fixtures/create-open-source-board-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("round-trips the open-source EBAZ4205 Altium board", async () => {
  const result = await createOpenSourceBoardRoundTrip({
    boardName: "EBAZ4205",
    filename: "ebaz4205.PcbDoc",
  })

  expect(result.roundTripCounts).toEqual(result.sourceCounts)
  expect(result.sourceNativeArcCount).toBe(476)
  expect(result.roundTripNativeArcCount).toBe(result.sourceNativeArcCount)
  expect(result.arcGeometryMismatches).toEqual([])
  expect(result.roundTripSourceNetNames).toEqual(result.sourceNetNames)
  expect(result.geometryMaxDeltaMm).toBeLessThan(0.03)
  expect(result.rotationMismatchCount).toBe(0)
  expect(result.silkscreenTextMismatchCount).toBe(0)
  expect(result.sourcePrimitiveTotal).toBeGreaterThan(5_000)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
