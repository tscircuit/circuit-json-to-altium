import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { cropSvgViewBox } from "./fixtures/crop-svg-view-box"

test("C11 decoupling capacitor exports passive pins without input arrows", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="10mm" height="10mm">
      <capacitor
        name="C11"
        capacitance="10nF"
        footprint="0603"
        connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "capacitor-section",
  })
  converter.runUntilFinished()
  const schematic = parseAltiumSchDoc(
    converter.getOutput().schematics[0]!.content,
  )
  const sourceSvg = await convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 500,
    height: 600,
  })
  const altiumSvg = cropSvgViewBox(
    serializeAltiumSheetToSvg(schematic, {
      width: 500,
      height: 600,
      margin: 0,
      showBorder: false,
    }),
    {
      x: 175,
      y: 120,
      width: 50,
      height: 60,
    },
  )
  await expect(
    createSideBySideSvg(sourceSvg, altiumSvg, {
      source: "Circuit JSON — C11 / V3V3 / GND",
      converted: "Exported SchDoc",
    }),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(schematic.pins).toHaveLength(2)
  expect(schematic.pins.map((pin) => pin.electricalType)).toEqual([4, 4])
  expect(altiumSvg).not.toContain("altium-schematic-pin-electrical-symbol")
  expect(schematic.wires).toHaveLength(6)
  expect(schematic.powerPorts.map((port) => port.text).sort()).toEqual([
    "GND",
    "V3V3",
  ])
})
