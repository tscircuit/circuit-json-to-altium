import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "../tests/fixtures/create-side-by-side-svg"

const assets = new URL("../tests/assets/", import.meta.url)
for (const [inputName, projectName, sheetIndex, outputName] of [
  [
    "ti-tps61288-power-supply",
    "ti-tps61288-small-junctions",
    0,
    "ti-tps61288-small-junctions",
  ],
  [
    "generated-system-automotive-mirror",
    "automotive-small-junctions",
    4,
    "automotive-microcontroller-small-junctions",
  ],
] as const) {
  const circuit = await Bun.file(
    new URL(`${inputName}.circuit.json`, assets),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuit, { projectName })
  converter.runUntilFinished()
  const sheet = converter.getOutput().schematics[sheetIndex]!
  await Bun.write(new URL(`${outputName}.SchDoc`, assets), sheet.content)
  const sourceSheet = circuit
    .filter((e: { type: string }) => e.type === "schematic_sheet")
    .sort(
      (a: { sheet_index: number }, b: { sheet_index: number }) =>
        a.sheet_index - b.sheet_index,
    )[sheetIndex - 1]
  const sourceSvg = convertCircuitJsonToSchematicSvg(
    circuit,
    sourceSheet ? { schematicSheetId: sourceSheet.schematic_sheet_id } : {},
  )
  const preview = serializeAltiumSheetToSvg(parseAltiumSchDoc(sheet.content))
  await Bun.write(
    new URL(`${outputName}.svg`, assets),
    createSideBySideSvg(sourceSvg, preview, {
      source: "Circuit JSON",
      converted: "Altium format preview",
    }),
  )
}
