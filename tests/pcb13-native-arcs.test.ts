import { expect, test } from "bun:test"
import {
  AltiumArcRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import {
  board,
  type CircuitElement,
  expectValidPcb,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

test("preserves PCB paths and circles as native Altium arcs", async () => {
  const quarterTurnBulge = -Math.tan(Math.PI / 8)
  const circuitJson: CircuitElement[] = [
    board({ width: 20, height: 12 }),
    sourceComponent("source_component_1", "U1"),
    pcbComponent({
      pcbComponentId: "pcb_component_1",
      sourceComponentId: "source_component_1",
    }),
    {
      type: "source_net",
      source_net_id: "source_net_1",
      name: "ARC_NET",
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_net_ids: ["source_net_1"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "pcb_keepout_1",
      shape: "circle",
      center: { x: -6, y: -3 },
      radius: 0.8,
      layers: ["all"],
    },
    {
      type: "pcb_courtyard_circle",
      pcb_courtyard_circle_id: "pcb_courtyard_circle_1",
      pcb_component_id: "pcb_component_1",
      layer: "top",
      center: { x: -6, y: 3 },
      radius: 0.8,
    },
    {
      type: "pcb_note_path",
      pcb_note_path_id: "pcb_note_path_1",
      layer: "top",
      route: [
        { x: -2, y: -4, bulge: quarterTurnBulge },
        { x: 0, y: -2 },
      ],
      stroke_width: 0.1,
    },
    {
      type: "pcb_fabrication_note_path",
      pcb_fabrication_note_path_id: "pcb_fabrication_note_path_1",
      pcb_component_id: "pcb_component_1",
      layer: "top",
      route: [
        { x: -2, y: 4, bulge: quarterTurnBulge },
        { x: 0, y: 2 },
      ],
      stroke_width: 0.1,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route: [
        {
          route_type: "wire",
          x: -4,
          y: 0,
          bulge: quarterTurnBulge,
          width: 0.3,
          layer: "top",
        },
        {
          route_type: "wire",
          x: 0,
          y: 4,
          width: 0.3,
          layer: "top",
        },
      ],
    },
    {
      type: "pcb_silkscreen_path",
      pcb_silkscreen_path_id: "pcb_silkscreen_path_1",
      pcb_component_id: "pcb_component_1",
      layer: "top",
      route: [
        { x: 2, y: 0, bulge: quarterTurnBulge },
        { x: 4, y: 2 },
      ],
      stroke_width: 0.15,
    },
    {
      type: "pcb_silkscreen_circle",
      pcb_silkscreen_circle_id: "pcb_silkscreen_circle_1",
      pcb_component_id: "pcb_component_1",
      center: { x: 5, y: -2 },
      radius: 1,
      layer: "top",
      stroke_width: 0.15,
    },
  ]
  const converter = new CircuitJsonToAltiumConverter(circuitJson)
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  const arcs = document.arcs.filter(
    (arc): arc is AltiumArcRecord => arc instanceof AltiumArcRecord,
  )
  const copperArc = arcs.find((arc) => arc.layer === "TOP")
  const silkscreenArcs = arcs.filter((arc) => arc.layer === "TOPOVERLAY")
  const keepoutCircle = arcs.find((arc) => arc.getBoolean("KEEPOUT") === true)
  const courtyardCircle = arcs.find((arc) => arc.layer === "MECHANICAL15")
  const documentationArcs = arcs.filter((arc) => arc.layer === "MECHANICAL1")

  expect(arcs).toHaveLength(7)
  expect(copperArc).toMatchObject({
    endAngle: 90,
    layer: "TOP",
    netIndex: 0,
    radiusMils: 157.4803,
    startAngle: 180,
    widthMils: 11.811,
  })
  expect(silkscreenArcs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        componentIndex: 0,
        endAngle: 90,
        radiusMils: 78.7402,
        startAngle: 180,
        widthMils: 5.9055,
      }),
      expect.objectContaining({
        componentIndex: 0,
        isFullCircle: true,
        radiusMils: 39.3701,
        widthMils: 5.9055,
      }),
    ]),
  )
  expect(keepoutCircle).toMatchObject({
    isFullCircle: true,
    layer: "KEEPOUT",
    radiusMils: 31.4961,
  })
  expect(courtyardCircle).toMatchObject({
    componentIndex: 0,
    isFullCircle: true,
    radiusMils: 31.4961,
  })
  expect(documentationArcs).toHaveLength(2)
  expect(
    documentationArcs
      .map((arc) => arc.componentIndex)
      .toSorted(
        (firstIndex, secondIndex) => (firstIndex ?? 0) - (secondIndex ?? 0),
      ),
  ).toEqual([0, 65_535])
  expect(document.tracks).toHaveLength(0)
  expectValidPcb(document)

  await expect(serializeAltiumPcbToSvg(document)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
