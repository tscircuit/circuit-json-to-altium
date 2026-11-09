import { expect, test } from "bun:test"
import { board, extractArchive } from "./fixtures"
import { viaRegressionCases } from "./fixtures/via-regressions"

for (const fixture of viaRegressionCases) {
  const elements = [
    board({ num_layers: 4 }),
    { type: "source_net", source_net_id: "gnd", name: "GND" },
    ...fixture.elements,
  ]
  test.failing(`${fixture.name}: preserves native via`, async () => {
    const { pcb } = await extractArchive(elements)
    const vias = pcb.getRecordsByKind("Via")
    expect(vias).toHaveLength(1)
    const via = vias[0]!
    expect([via.get("STARTLAYER"), via.get("ENDLAYER")]).toEqual(fixture.layers)
    expect(pcb.getNetForRecord(via)?.name).toBe("GND")
  })
}
