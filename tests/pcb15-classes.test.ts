import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "../lib"
import {
  board,
  type CircuitElement,
  pcbComponent,
  sourceComponent,
} from "./fixtures"

test("serializes source groups as native component and net classes", () => {
  const elements: CircuitElement[] = [
    board(),
    {
      ...sourceComponent("sc1", "U1"),
      source_group_id: "power_group",
    },
    {
      ...sourceComponent("sc2", "U2"),
      source_group_id: "power_group",
    },
    pcbComponent({ pcbComponentId: "pc1", sourceComponentId: "sc1" }),
    pcbComponent({ pcbComponentId: "pc2", sourceComponentId: "sc2" }),
    {
      type: "source_group",
      source_group_id: "power_group",
      name: "Power Domain",
    },
    {
      type: "source_net",
      source_net_id: "source_net_vcc",
      name: "VCC",
      member_source_group_ids: ["power_group"],
    },
    {
      type: "source_net",
      source_net_id: "source_net_gnd",
      name: "GND",
      member_source_group_ids: ["power_group"],
    },
  ]
  const converter = new CircuitJsonToAltiumConverter(elements)
  converter.runUntilFinished()
  const document = parseAltiumBinaryPcbDoc(converter.getOutput().pcb.content)

  expect(document.classes).toHaveLength(2)
  expect(document.classes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        classKind: "1",
        members: ["U1", "U2"],
        name: "Power Domain",
      }),
      expect.objectContaining({
        classKind: "0",
        members: ["VCC", "GND"],
        name: "Power Domain",
      }),
    ]),
  )
})
