import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { type AltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import {
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

const fixtureUrl = new URL(
  "./assets/sparkfun-transceiver-breakout-max3232.circuit.json",
  import.meta.url,
)

function addCanvasBackground(svg: string): string {
  const rootTag = svg.match(/<svg\b[^>]*>/u)?.[0]
  if (!rootTag) throw new Error("Expected an SVG root")
  return svg.replace(
    rootTag,
    `${rootTag}\n  <rect width="100%" height="100%" fill="rgb(245, 241, 237)"/>`,
  )
}

test("reproduces missing boxes on the full SparkFun MAX3232 board", async () => {
  const circuitJson = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as CircuitJson
  const sourceBoards = circuitJson.filter(
    (element) => element.type === "source_board",
  )
  const sourceComponents = circuitJson.filter(
    (element) => element.type === "source_component",
  )
  const pcbComponents = circuitJson.filter(
    (element) => element.type === "pcb_component",
  )
  const boxes = circuitJson.filter(
    (element) => element.type === "schematic_box",
  )
  const sheetTexts = circuitJson.flatMap((element) =>
    element.type === "schematic_text" &&
    !element.schematic_component_id &&
    !element.schematic_symbol_id
      ? [element]
      : [],
  )

  expect(sourceBoards).toHaveLength(1)
  expect(sourceComponents).toHaveLength(7)
  expect(pcbComponents).toHaveLength(7)
  expect(
    sourceComponents.some(
      (component) => component.manufacturer_part_number === "MAX3232ESE_UMW",
    ),
  ).toBe(true)
  expect(boxes).toHaveLength(2)
  expect(boxes.every((box) => box.is_dashed === true)).toBe(true)
  expect(sheetTexts.map((text) => text.text)).toEqual(["RS-232", "TTL/CMOS"])

  const { schematics } = await extractArchive(circuitJson as CircuitElement[])
  const schematic = schematics[0] as AltiumSchDoc
  expectValidSchematic(schematic)

  const rootPolylines = schematic
    .getRecordsByKind("6")
    .filter((record) => schematic.getParent(record) === undefined)
  const rootLabels = schematic
    .getRecordsByKind("4")
    .filter((record) => schematic.getParent(record) === undefined)
  expect(rootPolylines).toHaveLength(0)
  expect(rootLabels.map((record) => record.getDecoded("TEXT"))).toEqual([
    "RS-232",
    "TTL/CMOS",
  ])

  const sourceSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = serializeAltiumSheetToSvg(schematic, {
    backgroundColor: "rgb(245, 241, 237)",
    height: 700,
    margin: 20,
    showBorder: false,
    width: 700,
  })
  await expect(
    addCanvasBackground(createSideBySideSvg(sourceSvg, altiumSvg)),
  ).toMatchSvgSnapshot(import.meta.path)
})
