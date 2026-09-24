import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"
import { cropSvgViewBox } from "./fixtures/crop-svg-view-box"

const POWER_DETAIL_VIEW_BOX = {
  x: 135,
  y: 120,
  width: 130,
  height: 65,
}

test("snapshots a VCC and GND power-label detail", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="8mm">
      <resistor
        name="R1"
        resistance="1k"
        footprint="0402"
        schX={-2}
        schY={0}
        connections={{ pin1: "net.VCC", pin2: "C1.pin1" }}
      />
      <capacitor
        name="C1"
        capacitance="1uF"
        footprint="0603"
        schX={2}
        schY={0}
        connections={{ pin2: "net.GND" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "power-label-detail",
  })
  converter.runUntilFinished()
  const firstSchematic = converter.getOutput().schematics[0]
  if (!firstSchematic) throw new Error("Converter did not create a schematic")
  const altiumSchematic = parseAltiumSchDoc(firstSchematic.content)
  const sheetRecord = altiumSchematic.getRecordsByKind("31")[0]

  expect({
    height: sheetRecord?.getNumber("CUSTOMY"),
    width: sheetRecord?.getNumber("CUSTOMX"),
  }).toEqual({ height: 300, width: 400 })
  expect(
    altiumSchematic.powerPorts.map((powerPort) => ({
      color: powerPort.getNumber("COLOR"),
      orientation: powerPort.getNumber("ORIENTATION"),
      style: powerPort.getNumber("STYLE"),
      text: powerPort.text,
    })),
  ).toEqual([
    { color: 132, orientation: 1, style: 2, text: "VCC" },
    { color: 132, orientation: 3, style: 2, text: "GND" },
  ])

  const circuitJsonSvg = await convertCircuitJsonToSchematicSvg(circuitJson)
  const altiumSvg = cropSvgViewBox(
    serializeAltiumSheetToSvg(altiumSchematic, {
      height: 600,
      margin: 0,
      showBorder: false,
      width: 1200,
    }),
    POWER_DETAIL_VIEW_BOX,
  )
  await expect(
    createSideBySideSvg(circuitJsonSvg, altiumSvg),
  ).toMatchSvgSnapshot(import.meta.path)
})
