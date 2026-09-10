import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import CFB from "cfb"
import { CircuitJsonToAltiumConverter } from "../lib"
import { createPcbDocument } from "../lib/create-pcb-document"
import {
  board,
  type CircuitElement,
  pcbComponent,
  sourceComponent,
  sourcePort,
} from "./fixtures"

test("writes scoped native clearance rules and keepout unions through the binary export", () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("s1", "U2"),
    sourceComponent("s2", "U3"),
    pcbComponent({ pcbComponentId: "p1", sourceComponentId: "s1" }),
    pcbComponent({ pcbComponentId: "p2", sourceComponentId: "s2" }),
    sourcePort({
      sourceComponentId: "s1",
      sourcePortId: "port1",
      pinNumber: 1,
    }),
    sourcePort({
      sourceComponentId: "s2",
      sourcePortId: "port2",
      pinNumber: 1,
    }),
    { type: "source_net", source_net_id: "n1", name: "Allowed" },
    { type: "source_net", source_net_id: "n2", name: "Blocked" },
    {
      type: "source_trace",
      source_trace_id: "t1",
      connected_source_port_ids: ["port1"],
      connected_source_net_ids: ["n1"],
    },
    {
      type: "source_trace",
      source_trace_id: "t2",
      connected_source_port_ids: ["port2"],
      connected_source_net_ids: ["n2"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "rect",
      shape: "rect",
      center: { x: 0, y: 0 },
      width: 4,
      height: 3,
      layers: ["top", "bottom"],
      excluded_pcb_component_ids: ["p1", "p1"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "circle",
      shape: "circle",
      center: { x: 5, y: 0 },
      radius: 1,
      layers: ["all"],
      excluded_pcb_component_ids: ["p2"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "outline",
      shape: "outline",
      outline: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ],
      stroke_width: 0.2,
      layers: ["inner1"],
      excluded_pcb_component_ids: ["p1"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "ordinary",
      shape: "rect",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      layers: ["top"],
    },
  ]
  const original = structuredClone(elements)
  const converter = new CircuitJsonToAltiumConverter(elements)
  converter.runUntilFinished()
  const output = converter.getOutput()
  const pcb = parseAltiumBinaryPcbDoc(output.pcb.content)
  expect(pcb.rules).toHaveLength(3)
  expect(pcb.rules[0]!.scope1Expression).toBe("IsKeepOut And InUnion(1)")
  expect(pcb.rules[0]!.scope2Expression).toBe(
    "InComponent('U2') Or ((IsTrack Or IsArc) And InNet('Allowed'))",
  )
  expect(pcb.rules[1]!.scope1Expression).toBe("IsKeepOut And InUnion(2)")
  expect(pcb.rules[1]!.scope2Expression).toBe(
    "InComponent('U3') Or ((IsTrack Or IsArc) And InNet('Blocked'))",
  )
  expect(pcb.rules.map((rule) => rule.priority)).toEqual([1, 2, 3])
  for (const rule of pcb.rules) {
    expect(rule.ruleKind).toBe("Clearance")
    expect(rule.enabled).toBe(true)
    expect(rule.get("GAP")).toBe("0mil")
    expect(rule.get("NETSCOPE")).toBe("AnyNet")
    expect(rule.getNumber("BINARYRECORDTYPE")).toBe(0)
  }
  expect(pcb.getRecordsByKind("Region")[0]!.getNumber("UNIONINDEX")).toBe(2)
  // The pinned parser does not expose fill/track union tails, so inspect their native bytes.
  const fills = pcb.getRecordsByKind("Fill")
  expect(fills).toHaveLength(3)
  for (const fill of fills.slice(0, 2)) {
    const payload = fill.originalBinaryPayload!
    expect(
      new DataView(payload.buffer, payload.byteOffset).getUint32(37, true),
    ).toBe(1)
    expect(fill.getBoolean("KEEPOUT")).toBe(true)
  }
  expect(fills[2]!.originalBinaryPayload!.length).toBe(37)
  for (const track of pcb.getRecordsByKind("Track")) {
    const payload = track.originalBinaryPayload!
    expect(
      new DataView(payload.buffer, payload.byteOffset).getUint32(36, true),
    ).toBe(3)
    expect(track.getBoolean("KEEPOUT")).toBe(true)
  }
  const cf = CFB.read(output.pcb.content, { type: "buffer" })
  const header = Uint8Array.from(CFB.find(cf, "/Rules6/Header")!.content)
  expect(new DataView(header.buffer).getUint32(0, true)).toBe(3)
  const withoutExclusions = elements.map(
    ({ excluded_pcb_component_ids, ...element }) => element,
  )
  const unscopedSource = output.pcb.asciiContent
    .split("\r\n")
    .filter((line) => !line.startsWith("|RECORD=Rule|"))
    .map((line) => line.replace(/\|UNIONINDEX=\d+/gu, ""))
    .join("\r\n")
  expect(unscopedSource).toBe(createPcbDocument(withoutExclusions))
  expect(elements).toEqual(original)
})
