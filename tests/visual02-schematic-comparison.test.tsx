import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createCircuitJsonAltiumComparisonSvg } from "./fixtures/create-circuit-json-altium-comparison-svg"

test("shows the Circuit JSON and Altium schematic side by side", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="8mm">
      <resistor name="R1" resistance="1k" footprint="0402" schX={-2} schY={0} />
      <capacitor
        name="C1"
        capacitance="1uF"
        footprint="0603"
        schX={2}
        schY={0}
        connections={{ pin1: "R1.pin2" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "visual-schematic",
  })
  converter.runUntilFinished()
  const firstSchematic = converter.getOutput().schematics[0]
  if (!firstSchematic) throw new Error("Converter did not create a schematic")
  const altiumSchematic = parseAltiumSchDoc(firstSchematic.content)
  const comparisonSvg = createCircuitJsonAltiumComparisonSvg({
    altiumLabel: "Altium Schematic",
    altiumSvg: serializeAltiumSheetToSvg(altiumSchematic),
    circuitJsonSvg: await convertCircuitJsonToSchematicSvg(circuitJson),
  })

  await expect(comparisonSvg).toMatchSvgSnapshot(import.meta.path)
})
