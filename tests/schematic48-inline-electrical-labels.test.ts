import { expect, test } from "bun:test"
import {
  getSchematicNetGraph,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

test("preserves the DRV8307EVM HU+/UH+ six-terminal connection", async () => {
  // A minimized importer output: the HU+/UH+ trace, its six terminals,
  // components and inline texts. Components use the exporter's fallback boxes.
  const circuitJson = await Bun.file(
    new URL(
      "./assets/ti-drv8307evm-inline-labels.circuit.json",
      import.meta.url,
    ),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: "drv8307evm-inline-labels",
  })
  converter.runUntilFinished()
  const file = converter.getOutput().schematics.at(-1)!
  const document = parseAltiumSchDoc(file.content)
  const graph = getSchematicNetGraph(document)
  const nets = graph.getNetsByName("HU+")
  expect(nets).toHaveLength(1)
  expect(nets[0]!.names.toSorted()).toEqual(["HU+", "UH+"])
  const terminals = document.pins
    .filter((pin) => {
      const position = pin.position!
      const length = pin.getNumber("PINLENGTH") ?? 10
      const orientation = (pin.getNumber("PINCONGLOMERATE") ?? 0) & 3
      const x =
        position.x +
        (orientation === 0 ? length : orientation === 2 ? -length : 0)
      const y =
        position.y +
        (orientation === 1 ? length : orientation === 3 ? -length : 0)
      return nets[0]!.records
        .filter((record) => record.recordKind === "27")
        .some((wire) => {
          const [from, to] = getSchematicRecordPoints(wire)
          if (!from || !to) return false
          return (
            (x - from.x) * (to.y - from.y) === (y - from.y) * (to.x - from.x) &&
            x >= Math.min(from.x, to.x) &&
            x <= Math.max(from.x, to.x) &&
            y >= Math.min(from.y, to.y) &&
            y <= Math.max(from.y, to.y)
          )
        })
    })
    .map((pin) => {
      const component = document.getParent(pin)!
      const designator = document
        .getOwnedRecords(component)
        .find((record) => record.recordKind === "34")!
      return `${designator.getDecoded("TEXT")}.${pin.designator}`
    })
    .sort()
  expect(terminals).toEqual(["C10.1", "P3.7", "TP2.1", "U1.1", "U7.14", "U8.9"])
  expect(document.netLabels.map((label) => label.text)).toEqual([
    "HU+",
    "HU+",
    "HU+",
    "UH+",
    "HU+",
    "HU+",
  ])
  expect(document.getRecordsByKind("4")).toHaveLength(0)
  expectValidSchematic(document)
  await expect(serializeAltiumSheetToSvg(document)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test.each([
  { from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, rotation: 0 },
  { from: { x: 0, y: 0 }, to: { x: 0, y: 4 }, rotation: -90 },
  { from: { x: 0, y: 0 }, to: { x: 3, y: 2 }, rotation: 0 },
])(
  "places offset inline labels on their referenced wire: %p",
  async ({ from, to, rotation }) => {
    const elements: CircuitElement[] = [
      board(),
      { type: "source_net", source_net_id: "signal", name: "SIGNAL" },
      { type: "source_net", source_net_id: "other", name: "OTHER" },
      {
        type: "source_trace",
        source_trace_id: "signal_trace",
        connected_source_net_ids: ["signal"],
      },
      {
        type: "source_trace",
        source_trace_id: "other_trace",
        connected_source_net_ids: ["other"],
      },
      {
        type: "schematic_trace",
        schematic_trace_id: "signal_wire",
        source_trace_id: "signal_trace",
        edges: [{ from, to }],
      },
      {
        type: "schematic_trace",
        schematic_trace_id: "other_wire",
        source_trace_id: "other_trace",
        edges: [{ from: { x: 10, y: 0 }, to: { x: 10, y: 4 } }],
      },
      {
        type: "schematic_text",
        schematic_text_id: "inline_signal",
        source_trace_id: "signal_trace",
        text: "SIGNAL",
        position: { x: 10.05, y: 1.09 },
        anchor: "center",
        font_size: 0.18,
        color: "#123456",
        rotation,
      },
      {
        type: "schematic_text",
        schematic_text_id: "sheet_note",
        text: "SIGNAL",
        position: { x: 15, y: 0 },
        font_size: 0.18,
      },
      {
        type: "schematic_text",
        schematic_text_id: "trace_note",
        text: "NOTE",
        source_trace_id: "signal_trace",
        position: { x: 15, y: 1 },
        font_size: 0.18,
      },
      {
        type: "schematic_text",
        schematic_text_id: "dangling_note",
        text: "SIGNAL",
        source_trace_id: "missing_trace",
        position: { x: 15, y: 2 },
        font_size: 0.18,
      },
    ]
    const { schematics } = await extractArchive(elements)
    const document = schematics[0]!
    expect(document.netLabels).toHaveLength(1)
    const label = document.netLabels[0]!
    const position = label.position!
    const [start, end] = getSchematicRecordPoints(document.wires[0]!)
    expect((position.x - start!.x) * (end!.y - start!.y)).toBe(
      (position.y - start!.y) * (end!.x - start!.x),
    )
    const graph = getSchematicNetGraph(document)
    expect(graph.getNetForRecord(label)?.id).toBe(
      graph.getNetForRecord(document.wires[0]!)?.id,
    )
    expect(graph.getNetForRecord(label)?.id).not.toBe(
      graph.getNetForRecord(document.wires[1]!)?.id,
    )
    expect(label.getNumber("ORIENTATION")).toBe(rotation === -90 ? 1 : 0)
    expect(label.getNumber("COLOR")).toBe(0x56_34_12)
    expect(label.getNumber("JUSTIFICATION")).toBe(4)
    const sheet = document.getRecordsByKind("31")[0]!
    expect(sheet.getNumber(`SIZE${label.getNumber("FONTID")}`)).toBe(4)
    expect(
      document.getRecordsByKind("4").map((record) => record.getDecoded("TEXT")),
    ).toEqual(["SIGNAL", "NOTE", "SIGNAL"])
    expectValidSchematic(document)
  },
)

test("does not attach an inline text to a wire on another sheet", () => {
  const converter = new CircuitJsonToAltiumConverter([
    board(),
    { type: "source_net", source_net_id: "signal", name: "SIGNAL" },
    {
      type: "source_trace",
      source_trace_id: "trace",
      connected_source_net_ids: ["signal"],
    },
    { type: "schematic_sheet", schematic_sheet_id: "a", name: "A" },
    { type: "schematic_sheet", schematic_sheet_id: "b", name: "B" },
    {
      type: "schematic_trace",
      schematic_trace_id: "wire",
      schematic_sheet_id: "a",
      source_trace_id: "trace",
      edges: [{ from: { x: 0, y: 0 }, to: { x: 4, y: 0 } }],
    },
    {
      type: "schematic_text",
      schematic_text_id: "text",
      schematic_sheet_id: "b",
      source_trace_id: "trace",
      text: "SIGNAL",
      font_size: 0.18,
      position: { x: 1, y: 0.09 },
    },
  ])
  converter.runUntilFinished()
  const documents = converter
    .getOutput()
    .schematics.map((file) => parseAltiumSchDoc(file.content))
  expect(documents.flatMap((doc) => doc.netLabels)).toHaveLength(0)
  expect(
    documents.flatMap((doc) =>
      doc.getRecordsByKind("4").map((r) => r.getDecoded("TEXT")),
    ),
  ).toContain("SIGNAL")
})
