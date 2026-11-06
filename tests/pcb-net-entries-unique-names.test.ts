import { expect, test } from "bun:test"
import { createPcbNetEntries } from "../lib/create-pcb-net-entries"

test("createPcbNetEntries avoids duplicate PCB net names when suffixed names already exist", () => {
  const entriesWhenSuffixedFirst = createPcbNetEntries([
    {
      type: "source_net",
      source_net_id: "net_vcc_2",
      name: "VCC-2",
    },
    {
      type: "source_net",
      source_net_id: "net_vcc_a",
      name: "VCC",
    },
    {
      type: "source_net",
      source_net_id: "net_vcc_b",
      name: "VCC",
    },
  ])

  expect(entriesWhenSuffixedFirst.map((entry) => entry.name)).toEqual([
    "VCC-2",
    "VCC",
    "VCC-3",
  ])

  const entriesWhenSuffixedLast = createPcbNetEntries([
    {
      type: "source_net",
      source_net_id: "net_vcc_a",
      name: "VCC",
    },
    {
      type: "source_net",
      source_net_id: "net_vcc_b",
      name: "VCC",
    },
    {
      type: "source_net",
      source_net_id: "net_vcc_2",
      name: "VCC-2",
    },
  ])

  expect(entriesWhenSuffixedLast.map((entry) => entry.name)).toEqual([
    "VCC",
    "VCC-2",
    "VCC-2-2",
  ])
})
