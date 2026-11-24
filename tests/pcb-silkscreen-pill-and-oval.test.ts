import { expect, test } from "bun:test"
import { createPcbDocument } from "../lib/create-pcb-document"
import { MILLIMETERS_TO_MILS } from "../lib/format"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  extractArchive,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

const getTrackBoundsMil = (
  tracks: Array<{ get: (key: string) => string | undefined }>,
) => {
  const xs: number[] = []
  const ys: number[] = []
  for (const track of tracks) {
    xs.push(
      parseFloat(track.get("X1") ?? ""),
      parseFloat(track.get("X2") ?? ""),
    )
    ys.push(
      parseFloat(track.get("Y1") ?? ""),
      parseFloat(track.get("Y2") ?? ""),
    )
  }
  return {
    spanX: Math.max(...xs) - Math.min(...xs),
    spanY: Math.max(...ys) - Math.min(...ys),
  }
}

test("exports rotated component-owned silkscreen pills and standalone bottom silkscreen ovals", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("sc1", "U1"),
    pcbComponent({ pcbComponentId: "pc1", sourceComponentId: "sc1" }),
    {
      type: "pcb_silkscreen_pill",
      pcb_silkscreen_pill_id: "pill1",
      pcb_component_id: "pc1",
      layer: "top",
      center: { x: -3, y: 1 },
      width: 4,
      height: 1.5,
      ccw_rotation: 90,
    },
    {
      type: "pcb_silkscreen_oval",
      pcb_silkscreen_oval_id: "oval1",
      pcb_component_id: "",
      layer: "bottom",
      center: { x: 3, y: -1 },
      radius_x: 2.5,
      radius_y: 1,
      ccw_rotation: 90,
    },
  ]

  const pcbDocText = createPcbDocument(elements)
  const bottomAsciiLines = pcbDocText
    .split("\r\n")
    .filter((line) => line.includes("|RECORD=Track|LAYER=BOTTOMOVERLAY|"))
  expect(bottomAsciiLines).toHaveLength(48)
  expect(bottomAsciiLines.every((line) => !line.includes("|COMPONENT="))).toBe(
    true,
  )

  const { pcb } = await extractArchive(elements)
  const tracks = pcb.getRecordsByKind("Track")
  const topTracks = tracks.filter(
    (track) => track.get("LAYER") === "TOPOVERLAY",
  )
  const bottomTracks = tracks.filter(
    (track) => track.get("LAYER") === "BOTTOMOVERLAY",
  )

  expect(topTracks).toHaveLength(32)
  expect(topTracks.every((track) => track.get("COMPONENT") === "0")).toBe(true)
  expect(parseFloat(topTracks[0]?.get("WIDTH") ?? "")).toBeCloseTo(
    0.1 * MILLIMETERS_TO_MILS,
    3,
  )
  const pillBounds = getTrackBoundsMil(topTracks)
  expect(pillBounds.spanX).toBeCloseTo(1.5 * MILLIMETERS_TO_MILS, 1)
  expect(pillBounds.spanY).toBeCloseTo(4 * MILLIMETERS_TO_MILS, 1)

  expect(bottomTracks).toHaveLength(48)
  expect(
    bottomTracks.every((track) => track.get("COMPONENT") === "65535"),
  ).toBe(true)
  expect(parseFloat(bottomTracks[0]?.get("WIDTH") ?? "")).toBeCloseTo(
    0.1 * MILLIMETERS_TO_MILS,
    3,
  )
  const ovalBounds = getTrackBoundsMil(bottomTracks)
  expect(ovalBounds.spanX).toBeCloseTo(2 * MILLIMETERS_TO_MILS, 1)
  expect(ovalBounds.spanY).toBeCloseTo(5 * MILLIMETERS_TO_MILS, 1)

  expectValidPcb(pcb)
})
