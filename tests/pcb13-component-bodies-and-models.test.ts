import { expect, test } from "bun:test"
import {
  AltiumComponentBodyRecord,
  getPcbContour,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import {
  board,
  type CircuitElement,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

test("serializes CAD bodies and embedded STEP models", async () => {
  const stepSource =
    "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('converter test'),'2;1');\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"
  const elements: CircuitElement[] = [
    board({ thickness: 1.6 }),
    sourceComponent("sc1", "U1"),
    pcbComponent({ pcbComponentId: "pc1", sourceComponentId: "sc1" }),
    {
      type: "cad_component",
      cad_component_id: "cad1",
      pcb_component_id: "pc1",
      source_component_id: "sc1",
      position: { x: 2, y: -1, z: 1.8 },
      rotation: { x: 10, y: 20, z: 30 },
      size: { x: 4, y: 2, z: 2 },
      layer: "top",
      model_origin_position: { x: 0.5, y: -0.25, z: 0.2 },
      model_asset: {
        project_relative_path: "models/test-body.step",
        url: `data:model/step;base64,${btoa(stepSource)}`,
        mimetype: "model/step",
      },
    },
  ]
  const converter = new CircuitJsonToAltiumConverter(elements, {
    projectName: "component-body-test",
  })
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const componentBody = document.componentBodies[0]

  expect(componentBody).toBeInstanceOf(AltiumComponentBodyRecord)
  if (!(componentBody instanceof AltiumComponentBodyRecord)) {
    throw new Error("Expected a typed Altium component body record")
  }
  expect(componentBody).toMatchObject({
    componentIndex: 0,
    modelEmbedded: true,
    modelRotation3d: { x: 10, y: 20, z: 330 },
    overallHeightMils: 78.7402,
    standoffHeightMils: 0,
  })
  const bodyBounds = getPcbContour(componentBody).bounds
  if (!bodyBounds) throw new Error("Expected component-body bounds")
  expect(bodyBounds.maxX - bodyBounds.minX).toBeCloseTo(157.4803, 4)
  expect(bodyBounds.maxY - bodyBounds.minY).toBeCloseTo(78.7401, 4)
  expect(document.models[0]).toMatchObject({
    embedded: true,
    name: "models/test-body.step",
    rotation: { x: 10, y: 20, z: 330 },
  })
  const embeddedModel = document.getEmbeddedModelForComponentBody(componentBody)
  expect(embeddedModel).toBeDefined()
  expect(
    new TextDecoder().decode(await embeddedModel?.getDecompressedBytes()),
  ).toBe(stepSource)

  const svg = serializeAltiumPcbToSvg(document, {
    title: "Circuit JSON CAD body and STEP model",
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
