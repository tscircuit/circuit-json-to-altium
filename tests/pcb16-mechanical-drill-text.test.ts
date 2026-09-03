import { expect, test } from "bun:test"
import {
  AltiumBinaryPcbDoc,
  AltiumPcbDoc,
  parseAltiumFile,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { convertAltiumPcbToCircuitJson } from "./fixtures/convert-altium-pcb-to-circuit-json"
import { createOpenSourceBoardRoundTrip } from "./fixtures/create-open-source-board-round-trip"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

test("preserves mechanical and drill-layer PCB text as documentation", async () => {
  const sourceDocument = parseAltiumPcbDoc(
    [
      "|RECORD=Board|KIND=Protel_Advanced_PCB|VERSION=5.00|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|KIND2=0|VX2=1000mil|VY2=600mil|KIND3=0|VX3=0mil|VY3=600mil|KIND4=0|VX4=0mil|VY4=0mil",
      "|RECORD=Text|LAYER=DRILLDRAWING|X=250mil|Y=400mil|HEIGHT=60mil|WIDTH=6mil|ROTATION=0|JUSTIFICATION=5|TEXT=.Legend",
      "|RECORD=Text|LAYER=MECHANICAL13|X=500mil|Y=200mil|HEIGHT=50mil|WIDTH=5mil|ROTATION=90|JUSTIFICATION=5|TEXT=PIN 1",
    ].join("\n"),
  )
  const sourceCircuitJson = convertAltiumPcbToCircuitJson(sourceDocument)
  const documentationTexts = sourceCircuitJson.filter(
    (element) => element.type === "pcb_note_text",
  )

  expect(documentationTexts.map((element) => element.text)).toEqual([
    ".Legend",
    "PIN 1",
  ])

  const converter = new CircuitJsonToAltiumConverter(sourceCircuitJson, {
    projectName: "PCB documentation text layers",
  })
  converter.runUntilFinished()
  const generatedPcbBytes = Uint8Array.from(converter.getOutput().pcb.content)
  const roundTripDocument = parseAltiumFile(generatedPcbBytes).document
  if (
    !(roundTripDocument instanceof AltiumPcbDoc) &&
    !(roundTripDocument instanceof AltiumBinaryPcbDoc)
  ) {
    throw new Error(`Expected a PCB document, got ${roundTripDocument.type}`)
  }
  const roundTripTexts = convertAltiumPcbToCircuitJson(roundTripDocument)
    .filter((element) => element.type === "pcb_note_text")
    .map((element) => element.text)

  expect(roundTripTexts).toEqual([".Legend", "PIN 1"])
  await expect(
    createSideBySideSvg(
      serializeAltiumPcbToSvg(sourceDocument),
      serializeAltiumPcbToSvg(roundTripDocument),
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("shows recovered NodeMCU antenna text at readable scale", async () => {
  const nodeMcuAntennaDetail = await createOpenSourceBoardRoundTrip({
    boardName: "NodeMCU ESP-12 antenna text detail",
    filename: "nodemcu-esp12.PcbDoc",
    sourceSvgOptions: {
      viewBox: { x: 2_650, y: 3_880, width: 260, height: 160 },
    },
    roundTripSvgOptions: {
      viewBox: { x: 1_174, y: 2_730, width: 260, height: 160 },
    },
  })
  await expect(
    createSideBySideSvg(
      nodeMcuAntennaDetail.sourceSvg,
      nodeMcuAntennaDetail.roundTripSvg,
    ),
  ).toMatchSvgSnapshot(import.meta.path, "nodemcu-antenna-text")
})

test("shows the recovered NodeMCU legend at readable scale", async () => {
  const nodeMcuLegendDetail = await createOpenSourceBoardRoundTrip({
    boardName: "NodeMCU ESP-12 legend detail",
    filename: "nodemcu-esp12.PcbDoc",
    sourceSvgOptions: {
      viewBox: { x: 3_730, y: 1_830, width: 260, height: 240 },
    },
    roundTripSvgOptions: {
      viewBox: { x: 2_254, y: 680, width: 260, height: 240 },
    },
  })
  await expect(
    createSideBySideSvg(
      nodeMcuLegendDetail.sourceSvg,
      nodeMcuLegendDetail.roundTripSvg,
    ),
  ).toMatchSvgSnapshot(import.meta.path, "nodemcu-legend")
})

test("shows recovered HERON connector text at readable scale", async () => {
  const heronConnectorDetail = await createOpenSourceBoardRoundTrip({
    boardName: "HERON payload connector text detail",
    filename: "heron-payload-ssm.PcbDoc",
    sourceSvgOptions: {
      viewBox: { x: 2_150, y: 790, width: 760, height: 350 },
    },
    roundTripSvgOptions: {
      viewBox: { x: 3_150, y: 1_790, width: 760, height: 350 },
    },
  })
  await expect(
    createSideBySideSvg(
      heronConnectorDetail.sourceSvg,
      heronConnectorDetail.roundTripSvg,
    ),
  ).toMatchSvgSnapshot(import.meta.path, "heron-connector-text")
})
