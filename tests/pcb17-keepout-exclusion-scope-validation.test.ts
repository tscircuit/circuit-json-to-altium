import { expect, test } from "bun:test"
import { createPcbKeepoutExclusionRule } from "../lib/create-pcb-keepout-exclusion-rule"
import { pcbComponent, sourceComponent } from "./fixtures"

test("fails closed when a component exclusion cannot be scoped unambiguously", () => {
  const component = pcbComponent({
    pcbComponentId: "p1",
    sourceComponentId: "s1",
  })
  const makeRule = (name: string) =>
    createPcbKeepoutExclusionRule({
      circuitJson: [component, sourceComponent("s1", name)],
      excludedComponentIds: ["p1"],
      unionIndex: 1,
    })
  for (const name of ["U*", "U?"]) {
    expect(() => makeRule(name)).toThrow(
      "Cannot represent keepout exclusion query name",
    )
  }
  expect(makeRule("U|1")).toContain("InComponent('U 1')")
  expect(makeRule("U'2")).toContain("InComponent('U''2')")
  expect(() =>
    createPcbKeepoutExclusionRule({
      circuitJson: [component],
      excludedComponentIds: ["missing"],
      unionIndex: 1,
    }),
  ).toThrow("missing PCB component")
  expect(() =>
    createPcbKeepoutExclusionRule({
      circuitJson: [
        component,
        sourceComponent("s1", "U1"),
        pcbComponent({ pcbComponentId: "p2", sourceComponentId: "s2" }),
        sourceComponent("s2", "u1"),
      ],
      excludedComponentIds: ["p1"],
      unionIndex: 1,
    }),
  ).toThrow("ambiguous Altium component name")
})
