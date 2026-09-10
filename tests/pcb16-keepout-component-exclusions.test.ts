import { expect, test } from "bun:test"
import { AltiumBinaryPcbDoc, parseAltiumFile } from "altiumts"
import JSZip from "jszip"
import { CircuitJsonToAltiumConverter } from "../lib"
import {
  board,
  type CircuitElement,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

test("exports component-exempt keepouts conservatively with warnings in the API and ZIP", async () => {
  const elements: CircuitElement[] = [
    board({ width: 50, height: 40 }),
    sourceComponent("source_component_0", "U2"),
    pcbComponent({
      pcbComponentId: "pcb_component_0",
      sourceComponentId: "source_component_0",
    }),
    {
      type: "pcb_keepout",
      pcb_keepout_id: "pcb_keepout_4",
      shape: "rect",
      layers: ["top", "bottom"],
      width: 11,
      height: 17,
      center: { x: -18.5, y: 6 },
      excluded_pcb_component_ids: ["pcb_component_0"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "circle",
      shape: "circle",
      layers: ["top"],
      radius: 1.7,
      center: { x: 23, y: 18 },
      excluded_pcb_component_ids: ["pcb_component_0", "missing_component"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "outline",
      shape: "outline",
      layers: ["all"],
      stroke_width: 0.2,
      outline: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      excluded_pcb_component_ids: ["pcb_component_0"],
    },
  ]
  const original = structuredClone(elements)
  const converter = new CircuitJsonToAltiumConverter(elements)
  converter.runUntilFinished()
  const output = converter.getOutput()
  expect(output.warnings).toHaveLength(3)
  expect(output.warnings[0]).toContain("pcb_keepout_4")
  expect(output.warnings[0]).toContain("U2 (pcb_component_0)")
  expect(output.warnings[1]).toContain("missing_component")
  expect(elements).toEqual(original)
  const zip = await JSZip.loadAsync(await converter.getOutputZip())
  const readme = await zip.file("README.txt")!.async("string")
  for (const warning of output.warnings) expect(readme).toContain(warning)

  // Compare parsed native binary geometry against the same ordinary keepouts.
  const ordinary = elements.map(
    ({ excluded_pcb_component_ids, ...element }) => element,
  )
  const baseline = new CircuitJsonToAltiumConverter(ordinary)
  baseline.runUntilFinished()
  expect(baseline.getOutput().warnings).toEqual([])
  const actualPcb = parseAltiumFile(
    await zip.file(output.pcb.filename)!.async("uint8array"),
  ).document
  const expectedPcb = parseAltiumFile(baseline.getOutput().pcb.content).document
  if (
    !(actualPcb instanceof AltiumBinaryPcbDoc) ||
    !(expectedPcb instanceof AltiumBinaryPcbDoc)
  )
    throw new Error("Expected binary PCB documents")
  for (const kind of ["Fill", "Region", "Track"] as const) {
    const records = actualPcb.getRecordsByKind(kind)
    expect(records.length).toBeGreaterThan(0)
    expect(records.map((record) => record.getString())).toEqual(
      expectedPcb.getRecordsByKind(kind).map((record) => record.getString()),
    )
    expect(records.every((record) => record.getBoolean("KEEPOUT"))).toBe(true)
  }
})
