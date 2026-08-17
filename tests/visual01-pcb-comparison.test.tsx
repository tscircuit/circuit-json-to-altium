import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "altiumts"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createCircuitJsonAltiumComparisonSvg } from "./fixtures/create-circuit-json-altium-comparison-svg"

test("shows the Circuit JSON and Altium PCB side by side", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="8mm">
      <resistor name="R1" resistance="1k" footprint="0402" pcbX={-2} pcbY={0} />
      <capacitor
        name="C1"
        capacitance="1uF"
        footprint="0603"
        pcbX={2}
        pcbY={0}
        connections={{ pin1: "R1.pin2" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "visual-pcb",
  })
  converter.runUntilFinished()
  const altiumPcb = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const comparisonSvg = createCircuitJsonAltiumComparisonSvg({
    altiumLabel: "Altium PCB",
    altiumSvg: serializeAltiumPcbToSvg(altiumPcb),
    circuitJsonSvg: await convertCircuitJsonToPcbSvg(circuitJson, {
      showCourtyards: true,
    }),
  })

  await expect(comparisonSvg).toMatchSvgSnapshot(import.meta.path)
})
