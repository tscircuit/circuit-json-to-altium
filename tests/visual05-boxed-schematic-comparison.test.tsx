import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { renderAltiumSchematicDetail } from "./fixtures/render-altium-schematic-detail"

const BOXED_COMPONENT_VIEW_BOX = {
  x: 150.5,
  y: 123,
  width: 99,
  height: 54,
}

test("snapshots boxed component pin text", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="12mm">
      <chip
        name="U1"
        footprint="soic8"
        pinLabels={{
          pin1: "VCC",
          pin2: "DISCH",
          pin3: "THRES",
          pin4: "CTRL",
          pin5: "GND",
          pin6: "TRIG",
          pin7: "OUT",
          pin8: "RESET",
        }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "boxed-schematic",
  })
  converter.runUntilFinished()
  const firstSchematic = converter.getOutput().schematics[0]
  if (!firstSchematic) throw new Error("Converter did not create a schematic")
  const altiumSchematic = parseAltiumSchDoc(firstSchematic.content)
  const circuitJsonSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = renderAltiumSchematicDetail(
    altiumSchematic,
    BOXED_COMPONENT_VIEW_BOX,
  )

  await expect(
    createSideBySideSvg(circuitJsonSvg, altiumSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
