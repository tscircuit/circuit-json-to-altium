import { expect, test } from "bun:test"
import { createOpenSourceBoardRoundTrip } from "./fixtures/create-open-source-board-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("round-trips the open-source NodeMCU ESP-12 Altium board", async () => {
  const result = await createOpenSourceBoardRoundTrip({
    boardName: "NodeMCU ESP-12",
    filename: "nodemcu-esp12.PcbDoc",
  })

  expect(result.roundTripCounts).toEqual(result.sourceCounts)
  expect(result.roundTripSourceNetNames).toEqual(result.sourceNetNames)
  expect(result.cadComponentMismatchCount).toBe(0)
  expect(result.geometryMaxDeltaMm).toBeLessThan(0.03)
  expect(result.rotationMismatchCount).toBe(0)
  expect(result.silkscreenTextMismatchCount).toBe(0)
  expect(result.solderPasteMismatchCount).toBe(0)
  expect(result.sourcePrimitiveTotal).toBeGreaterThan(5_000)
  await expect(
    createSideBySideSvg(result.sourceSvg, result.roundTripSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
