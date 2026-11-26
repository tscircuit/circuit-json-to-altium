import { expect, test } from "bun:test"
import { createOpenSourceBoardRoundTrip } from "./fixtures/create-open-source-board-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("round-trips the open-source SimpleFOC Mini Altium board", async () => {
  const result = await createOpenSourceBoardRoundTrip({
    boardName: "SimpleFOC Mini",
    filename: "simplefoc-mini.PcbDoc",
  })

  expect(result.roundTripCounts).toEqual(result.sourceCounts)
  expect(result.semanticMismatches).toEqual([])
  expect(result.roundTripSourceNetNames).toEqual(result.sourceNetNames)
  expect(result.geometryMaxDeltaMm).toBeLessThan(0.03)
  expect(result.rotationMismatchCount).toBe(0)
  expect(result.silkscreenTextMismatchCount).toBe(0)
  expect(result.sourcePrimitiveTotal).toBeGreaterThan(500)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
