import { expect, test } from "bun:test"
import {
  getSchematicRecordPoints,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "altiumts"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { pointedNetLabelDetail } from "./fixtures/pointed-net-label-detail"

test("compares native pointed VIN_DC_DC and EN_3P3 labels with Circuit JSON", async () => {
  const converter = new CircuitJsonToAltiumConverter(pointedNetLabelDetail, {
    projectName: "pointed-net-label-detail",
  })
  converter.runUntilFinished()
  const document = parseAltiumSchDoc(
    converter.getOutput().schematics[0]!.content,
  )
  const points = document.records
    .filter((record) => record.recordKind === "7" || record.recordKind === "27")
    .flatMap(getSchematicRecordPoints)
  const minX = Math.min(...points.map((p) => p.x)) - 6
  const minY = Math.min(...points.map((p) => p.y)) - 6
  const maxX = Math.max(...points.map((p) => p.x)) + 6
  const maxY = Math.max(...points.map((p) => p.y)) + 6
  const viewBoxHeight = (maxX - minX) / 2
  const nativeSvg = serializeAltiumSheetToSvg(document, {
    showBorder: false,
    width: 600,
    height: 300,
    margin: 0,
    viewBox: {
      x: minX,
      y: (minY + maxY - viewBoxHeight) / 2,
      width: maxX - minX,
      height: viewBoxHeight,
    },
  })
  for (const text of ["VIN_DC_DC", "EN_3P3"]) {
    expect(nativeSvg.split(`>${text}</text>`)).toHaveLength(2)
  }
  const sourceSvg = convertCircuitJsonToSchematicSvg(
    pointedNetLabelDetail as AnyCircuitElement[],
    { width: 600, height: 300 },
  )
  await expect(
    createSideBySideSvg(sourceSvg, nativeSvg, {
      source: "Circuit JSON",
      converted: "Altium format preview (local altiumts renderer)",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
