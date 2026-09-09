import { expect, test } from "bun:test"
import { serializeAltiumSheetToSvg } from "altiumts"
import { board, extractArchive, sourceComponent, sourcePort } from "./fixtures"

test("renders an exported Circuit JSON schematic with the installed native renderer", async () => {
  const { schematics } = await extractArchive([
    board(),
    sourceComponent("chip", "U1"),
    sourcePort({
      sourcePortId: "pin",
      sourceComponentId: "chip",
      pinNumber: 1,
    }),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_chip",
      source_component_id: "chip",
      center: { x: 0, y: 0 },
      size: { width: 4, height: 2 },
    },
    {
      type: "schematic_port",
      schematic_port_id: "schematic_pin",
      schematic_component_id: "schematic_chip",
      source_port_id: "pin",
      center: { x: -2.5, y: 0 },
      distance_from_component_edge: 0.5,
      facing_direction: "left",
      display_pin_label: "SIGNAL",
    },
  ])
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected an exported schematic")

  // Check the actual exported file through the pinned renderer. Detailed
  // native field interpretation belongs to altiumts's renderer tests.
  const svg = serializeAltiumSheetToSvg(schematic)
  expect(svg).toContain(">U1</text>")
  expect(svg).toContain(">SIGNAL</text>")
  for (const text of ["SIGNAL", "1"]) {
    const element = svg.match(new RegExp(`<text[^>]*>${text}</text>`))?.[0]
    expect(element).toContain('font-family="Arial"')
    expect(element).toContain('font-size="4"')
  }
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
