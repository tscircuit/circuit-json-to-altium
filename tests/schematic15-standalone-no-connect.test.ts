import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { convertAltiumSchematicToCircuitJson } from "./fixtures/convert-altium-schematic-to-circuit-json"

test("round-trips a standalone Altium No ERC marker without adding a port symbol", () => {
  const sourceDocument = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|CUSTOMX=200|CUSTOMY=200|USECUSTOMSHEET=T",
      "|RECORD=22|LOCATION.X=120|LOCATION.Y=140|ISACTIVE=T|SYMBOL=Thin Cross|ORIENTATION=1|OWNERPARTID=-1|COLOR=255|SUPPRESSALL=T",
    ].join("\n"),
  )
  const sourceCircuitJson = convertAltiumSchematicToCircuitJson(sourceDocument)
  const sourcePort = sourceCircuitJson.find(
    (element) => element.type === "source_port",
  )
  const schematicPort = sourceCircuitJson.find(
    (element) => element.type === "schematic_port",
  )

  expect(sourcePort).toMatchObject({
    do_not_connect: true,
    name: "No Connect",
    type: "source_port",
  })
  expect(schematicPort).toMatchObject({
    center: { x: 6, y: 7 },
    source_port_id: sourcePort?.source_port_id,
    type: "schematic_port",
  })

  const converter = new CircuitJsonToAltiumConverter(sourceCircuitJson, {
    schematicUnitsPerCircuitUnit: 20,
  })
  converter.runUntilFinished()
  const generatedSchematic = converter.getOutput().schematics[0]
  if (!generatedSchematic) {
    throw new Error("Converter did not create a schematic document")
  }
  const roundTripDocument = parseAltiumSchDoc(generatedSchematic.content)

  expect(roundTripDocument.getRecordsByKind("18")).toHaveLength(0)
  expect(roundTripDocument.getRecordsByKind("22")).toHaveLength(1)
})
