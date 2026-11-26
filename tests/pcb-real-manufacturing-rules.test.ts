import { expect, test } from "bun:test"
import type { AltiumPcbDocument } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const elements = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  return {
    ...(await extractArchive(elements)),
    board: elements.find((element) => element.type === "pcb_board")!,
  }
}

function getMinimumMillimeters({
  pcb,
  name,
  field,
}: {
  pcb: AltiumPcbDocument
  name: string
  field: string
}): number | null {
  const minimumMillimeters = pcb.rules
    .find((rule) => rule.get("NAME") === name)
    ?.getAltiumMeasurement(field)
    ?.toMillimeters()
  return minimumMillimeters === undefined
    ? null
    : Number(minimumMillimeters.toFixed(4))
}

test("preserves manufacturing width and clearance settings already present on the real board", async () => {
  const { pcb, board } = await scenario()
  const width = pcb.rules.find(
    (rule) => rule.get("NAME") === "TscircuitMinTraceWidth",
  )
  expect(width?.getAltiumMeasurement("MINLIMIT")?.toMillimeters()).toBeCloseTo(
    Number(board.min_trace_width),
    4,
  )
  const clearance = pcb.rules.find(
    (rule) => rule.get("NAME") === "TscircuitTraceToPadClearance",
  )
  expect(clearance?.getAltiumMeasurement("GAP")?.toMillimeters()).toBeCloseTo(
    Number(board.min_trace_to_pad_edge_clearance),
    4,
  )
  expect(
    pcb.rules
      .find((rule) => rule.ruleKind === "BoardOutlineClearance")
      ?.getAltiumMeasurement("GAP")
      ?.toMillimeters(),
  ).toBeCloseTo(Number(board.min_board_edge_clearance), 4)
}, 30_000)

test("records the real board's exported manufacturing minima", async () => {
  const { pcb } = await scenario()
  expect({
    minimumTraceWidthMm: getMinimumMillimeters({
      pcb,
      name: "TscircuitMinTraceWidth",
      field: "MINLIMIT",
    }),
    traceToPadGapMm: getMinimumMillimeters({
      pcb,
      name: "TscircuitTraceToPadClearance",
      field: "GAP",
    }),
    boardEdgeGapMm: getMinimumMillimeters({
      pcb,
      name: "TscircuitBoardEdgeClearance",
      field: "GAP",
    }),
    ruleCount: pcb.rules.length,
  }).toMatchInlineSnapshot(`
    {
      "boardEdgeGapMm": 0.2,
      "minimumTraceWidthMm": 0.1,
      "ruleCount": 8,
      "traceToPadGapMm": 0.1,
    }
  `)
}, 30_000)
