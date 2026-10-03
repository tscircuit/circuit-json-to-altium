import { expect, test } from "bun:test"
import {
  type AltiumRecord,
  getSchematicNetGraph,
  parseAltiumBinaryPcbDoc,
  parseAltiumSchDoc,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"

// Offline checks for what Altium Designer needs to open an export as a
// usable project (verified against files re-saved by Altium 26):
// project version, Board6 layer stack, PCB designator primitives,
// schematic->footprint links and electrical trace-name labels.
// A board with placed footprints and a multi-sheet schematic with
// tscircuit trace-name labels.
const BOARD_FIXTURE = "sparkfun-level-shifter-8-channel-txs0108e"
const TRACE_LABEL_FIXTURE = "generated-system-blood-pressure-monitor"

const loadExport = async (fixture = BOARD_FIXTURE) => {
  const circuitJson = await Bun.file(
    new URL(`./assets/${fixture}.circuit.json`, import.meta.url),
  ).json()
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName: fixture,
  })
  converter.runUntilFinished()
  const output = converter.getOutput()
  return {
    circuitJson: circuitJson as Array<Record<string, unknown>>,
    output,
    pcb: parseAltiumBinaryPcbDoc(output.pcb.content),
    sheets: output.schematics.map((sheet) => ({
      filename: sheet.filename,
      doc: parseAltiumSchDoc(sheet.content),
    })),
  }
}

test("project file declares an Altium project version", async () => {
  const { output } = await loadExport()
  const lines = output.project.content.split("\r\n")
  expect(lines.slice(0, 2)).toEqual(["[Design]", "Version=1.0"])
  // Schematics first, PCB last: Altium's compiled netlist is empty otherwise.
  const documentPaths = lines
    .filter((line) => line.startsWith("DocumentPath="))
    .map((line) => line.slice("DocumentPath=".length))
  expect(documentPaths).toEqual([
    ...output.schematics.map((sheet) => sheet.filename),
    output.pcb.filename,
  ])
})

test("Board6 carries a two-layer stack", async () => {
  const { pcb } = await loadExport()
  const boardRecord = pcb.getRecordsByKind("Board")[0]!
  expect(boardRecord.get("V9_STACK_LAYER3_NAME")).toBe("Top Layer")
  expect(boardRecord.get("V9_STACK_LAYER5_NAME")).toBe("Bottom Layer")
  expect(boardRecord.get("LAYER1NAME")).toBe("Top Layer")
  expect(boardRecord.get("LAYERPAIR0LOW")).toBe("TOP")
})

test("each PCB component owns one designator text with its designator", async () => {
  const { pcb } = await loadExport()
  const components = pcb.getRecordsByKind("Component")
  expect(components.length).toBeGreaterThan(0)
  const texts = pcb.getRecordsByKind("Text")
  for (const [index, component] of components.entries()) {
    const designators = texts.filter(
      (text) =>
        text.get("COMPONENT") === String(index) &&
        text.getBoolean("DESIGNATOR"),
    )
    expect(designators.map((text) => decodeText(text))).toEqual([
      component.get("SOURCEDESIGNATOR")!,
    ])
    expect(
      texts.filter(
        (text) =>
          text.get("COMPONENT") === String(index) && text.getBoolean("COMMENT"),
      ),
    ).toHaveLength(1)
  }
  // Footprints are named from Circuit JSON, not from the rotated bounding box.
  const patterns = components.map((component) => component.get("PATTERN"))
  expect(
    patterns.filter((pattern) => pattern?.startsWith("TSCIRCUIT-")),
  ).toEqual([])
})

test("every schematic component links to its PCB footprint", async () => {
  const { pcb, sheets } = await loadExport()
  const patternByDesignator = new Map(
    pcb
      .getRecordsByKind("Component")
      .map((component) => [
        component.get("SOURCEDESIGNATOR"),
        component.get("PATTERN"),
      ]),
  )
  let linked = 0
  for (const { doc } of sheets) {
    const records = doc.records
    const byIndex = (index: number | undefined) =>
      index === undefined ? undefined : records[index]
    for (const model of doc.getRecordsByKind("45")) {
      expect(model.getDecoded("MODELTYPE")).toBe("PCBLIB")
      const list = byIndex(model.getNumber("OWNERINDEX"))
      expect(list?.recordKind).toBe("44")
      const component = byIndex(list?.getNumber("OWNERINDEX"))
      expect(component?.recordKind).toBe("1")
      const designator = records
        .filter(
          (record) =>
            record.recordKind === "34" &&
            byIndex(record.getNumber("OWNERINDEX")) === component,
        )[0]
        ?.getDecoded("TEXT")
      expect(model.getDecoded("MODELNAME")).toBe(
        patternByDesignator.get(designator)!,
      )
      linked++
    }
  }
  // Every placed PCB component is reachable from exactly one symbol.
  expect(linked).toBe(patternByDesignator.size)
})

test("trace-name labels are electrical net labels joining their pins", async () => {
  const { circuitJson, sheets } = await loadExport(TRACE_LABEL_FIXTURE)
  const traceLabelNames = new Set(
    circuitJson
      .filter(
        (element) =>
          element.type === "schematic_text" &&
          typeof element.source_trace_id === "string",
      )
      .map((element) => String(element.text)),
  )
  expect(traceLabelNames.size).toBeGreaterThan(0)
  for (const { doc } of sheets) {
    expect(
      doc
        .getRecordsByKind("4")
        .filter((record) => traceLabelNames.has(record.getDecoded("TEXT")!)),
    ).toEqual([])
    const graph = getSchematicNetGraph(doc)
    for (const label of doc.netLabels) {
      if (!traceLabelNames.has(label.text ?? "")) continue
      // The label hotspot touches a wire or pin, so its net has a pin.
      const net = graph.getNetForRecord(label)
      expect(
        net?.records.some((record) => record.recordKind === "2"),
      ).toBeTrue()
    }
  }
})

function decodeText(text: AltiumRecord): string {
  const wide = text.get("WIDESTRING")
  return wide
    ? String.fromCodePoint(...wide.split(",").map(Number))
    : (text.get("TEXT") ?? "")
}
