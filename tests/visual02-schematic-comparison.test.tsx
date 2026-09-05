import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { renderAltiumSchematicDetail } from "./fixtures/render-altium-schematic-detail"

const PASSIVE_CHAIN_VIEW_BOX = {
  x: 139.5,
  y: 117,
  width: 121,
  height: 66,
}

test("snapshots the Circuit JSON and generated Altium schematic", async () => {
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
  const circuitJsonSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = renderAltiumSchematicDetail(
    altiumSchematic,
    PASSIVE_CHAIN_VIEW_BOX,
  )

  await expect(
    createSideBySideSvg(circuitJsonSvg, altiumSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
