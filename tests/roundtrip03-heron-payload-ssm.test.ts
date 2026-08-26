import { expect, test } from "bun:test"
import { createOpenSourceBoardRoundTrip } from "./fixtures/create-open-source-board-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("round-trips the open-source HERON payload SSM Altium board", async () => {
  const result = await createOpenSourceBoardRoundTrip({
    boardName: "HERON Payload SSM",
    filename: "heron-payload-ssm.PcbDoc",
  })

  expect(result.roundTripCounts).toEqual(result.sourceCounts)
  expect(result.sourceNativeArcCount).toBe(68)
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
