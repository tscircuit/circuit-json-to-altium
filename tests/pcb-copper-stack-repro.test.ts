import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board } from "./fixtures"

test("preserves a declared four-layer copper stack", () => {
  const converter = new CircuitJsonToAltiumConverter([board({ num_layers: 4 })])
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)
  expect(document.board?.layerStack.entries).toHaveLength(4)
  expect(document.board?.layerStack.entries.map((entry) => entry.name)).toEqual(
    ["Top Layer", "Mid-Layer 1", "Mid-Layer 2", "Bottom Layer"],
  )
})
