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
  "./assets/sparkfun-level-shifter-8-channel-txs0108e.circuit.json",
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

test("reproduces the missing table on the full SparkFun TXS0108E board", async () => {
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
  const tables = circuitJson.filter(
    (element) => element.type === "schematic_table",
  )
  const tableCells = circuitJson.filter(
    (element) => element.type === "schematic_table_cell",
  )
  const sourceRectangles = circuitJson.filter(
    (element) => element.type === "schematic_rect",
  )

  expect(sourceBoards).toHaveLength(1)
  expect(sourceComponents).toHaveLength(8)
  expect(pcbComponents).toHaveLength(8)
  expect(
    sourceComponents.some(
      (component) => component.manufacturer_part_number === "TXS0108EQWRKSRQ1",
    ),
  ).toBe(true)
  expect(tables).toHaveLength(1)
  expect(tables[0]?.column_widths).toEqual([2.5, 2.5])
  expect(tables[0]?.row_heights).toEqual([0.6, 0.6, 0.6, 0.6])
  expect(tableCells.map((cell) => cell.text)).toEqual([
    "Must have VCCA <= VCCB",
    "VCCA Range:",
    "VCCB Range:",
    "1.4V to 3.6V",
    "1.65V to 5.5V",
    "OE voltage is referenced to VCCA",
  ])

  const { schematics } = await extractArchive(circuitJson as CircuitElement[])
  const schematic = schematics[0] as AltiumSchDoc
  expectValidSchematic(schematic)

  const rootRectangles = schematic
    .getRecordsByKind("14")
    .filter((record) => schematic.getParent(record) === undefined)
  const rootLabels = schematic
    .getRecordsByKind("4")
    .filter((record) => schematic.getParent(record) === undefined)
  expect(rootRectangles).toHaveLength(sourceRectangles.length)
  expect(
    rootLabels.some((record) => record.getDecoded("TEXT") === "VCCA Range:"),
  ).toBe(false)

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
