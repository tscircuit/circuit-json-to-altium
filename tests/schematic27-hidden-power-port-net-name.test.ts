import { expect, test } from "bun:test"
import type { AltiumSchDoc } from "altiumts"
import { board, type CircuitElement, extractArchive } from "./fixtures"

test("writes hidden power-port net names without displaying them", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "source_net",
      source_net_id: "source_net_ground",
      name: "GND",
    },
    {
      type: "schematic_net_label",
      schematic_net_label_id: "hidden_ground",
      source_net_id: "source_net_ground",
      center: { x: 0, y: 0 },
      anchor_position: { x: 0, y: 0 },
      anchor_side: "top",
      symbol_name: "ground_down",
      text: "",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const powerPort = schematic.powerPorts[0]

  expect(powerPort?.text).toBe("GND")
  expect(powerPort?.getBoolean("SHOWNETNAME")).toBe(false)
})
