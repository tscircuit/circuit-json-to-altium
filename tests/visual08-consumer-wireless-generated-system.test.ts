import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

const fixtureUrl = new URL(
  "./assets/consumer-wireless-generated-system.circuit.json",
  import.meta.url,
)

test("reproduces the Consumer Wireless Module generated system", async () => {
  const circuitJson = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as AnyCircuitElement[]
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "consumer-wireless-module",
  })
  converter.runUntilFinished()

  const { schematics } = converter.getOutput()
  expect(schematics.map(({ filename }) => filename)).toEqual([
    "consumer-wireless-module.SchDoc",
    "consumer-wireless-module-01.SchDoc",
    "consumer-wireless-module-02.SchDoc",
    "consumer-wireless-module-03.SchDoc",
    "consumer-wireless-module-04.SchDoc",
    "consumer-wireless-module-05.SchDoc",
    "consumer-wireless-module-06.SchDoc",
    "consumer-wireless-module-07.SchDoc",
    "consumer-wireless-module-08.SchDoc",
  ])

  const parsedSchematics = schematics.map(({ content }) =>
    parseAltiumSchDoc(content),
  )
  for (const schematic of parsedSchematics) {
    expectValidSchematic(schematic)
  }

  const sourceSheets = circuitJson
    .filter((element) => element.type === "schematic_sheet")
    .sort(
      (left, right) =>
        Number(left.sheet_index ?? 0) - Number(right.sheet_index ?? 0),
    )
  expect(sourceSheets.map(({ name }) => name)).toEqual([
    "system_diagram",
    "dc_dc_power_supply",
    "input_power_protection",
    "io_connection",
    "io_protection",
    "logic_control",
    "sensors",
    "wireless_connectivity",
  ])

  const rootSchematic = parsedSchematics[0]
  if (!rootSchematic) throw new Error("Converter did not create a root sheet")
  expect(
    rootSchematic.sheetLinks.map(({ fileName, name }) => ({ fileName, name })),
  ).toEqual(
    sourceSheets.map((sheet, index) => ({
      fileName: `consumer-wireless-module-${String(index + 1).padStart(2, "0")}.SchDoc`,
      name: String(Reflect.get(sheet, "display_name") ?? sheet.name),
    })),
  )

  const snapshots = [serializeAltiumSheetToSvg(rootSchematic)]
  const snapshotNames = ["root-hierarchy"]
  for (const [index, sourceSheet] of sourceSheets.entries()) {
    const generatedSchematic = parsedSchematics[index + 1]
    if (!generatedSchematic) {
      throw new Error(`Missing generated child sheet ${index + 1}`)
    }
    const schematicSheetId = String(sourceSheet.schematic_sheet_id)
    const circuitJsonSvg = convertCircuitJsonToSchematicSvg(circuitJson, {
      schematicSheetId,
    })
    const altiumSvg = serializeAltiumSheetToSvg(generatedSchematic)
    snapshots.push(createSideBySideSvg(circuitJsonSvg, altiumSvg))
    snapshotNames.push(
      `${String(index + 1).padStart(2, "0")}-${String(sourceSheet.name).replaceAll("_", "-")}`,
    )
  }

  await expect(snapshots).toMatchMultipleSvgSnapshots(
    import.meta.path,
    snapshotNames,
  )
}, 30_000)
