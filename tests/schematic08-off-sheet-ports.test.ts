import { expect, test } from "bun:test"
import type { AltiumSchDoc } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
} from "./fixtures"

type SchematicOffSheetPortDefinition = {
  center: { x: number; y: number }
  facing_direction?: "up"
  has_input_arrow?: boolean
  has_output_arrow?: boolean
  name: string
}

const portDefinitions: SchematicOffSheetPortDefinition[] = [
  {
    center: { x: 0, y: 0 },
    name: "UNSPECIFIED",
  },
  {
    center: { x: 2, y: 0 },
    has_input_arrow: true,
    name: "INPUT",
  },
  {
    center: { x: 4, y: 0 },
    has_output_arrow: true,
    name: "OUTPUT_SIGNAL",
  },
  {
    center: { x: 6, y: 0 },
    has_input_arrow: true,
    has_output_arrow: true,
    name: "BIDIRECTIONAL",
  },
  {
    center: { x: 8, y: 0 },
    facing_direction: "up",
    has_output_arrow: true,
    name: "VERTICAL_OUTPUT",
  },
]

const elements: CircuitElement[] = [
  board(),
  ...portDefinitions.flatMap((portDefinition, portIndex) => {
    const sourcePortId = `source_port_${portIndex}`
    return [
      {
        type: "source_port",
        source_port_id: sourcePortId,
        name: portDefinition.name,
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_${portIndex}`,
        source_port_id: sourcePortId,
        center: portDefinition.center,
        display_pin_label: portDefinition.name,
        ...(portDefinition.facing_direction
          ? { facing_direction: portDefinition.facing_direction }
          : {}),
        ...(portDefinition.has_input_arrow ? { has_input_arrow: true } : {}),
        ...(portDefinition.has_output_arrow ? { has_output_arrow: true } : {}),
      },
    ]
  }),
  {
    type: "source_port",
    source_port_id: "source_port_unconnected",
    name: "UNCONNECTED",
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_unconnected",
    source_port_id: "source_port_unconnected",
    center: { x: 8, y: 0 },
    display_pin_label: "UNCONNECTED",
    is_connected: false,
  },
]

test("writes visible componentless schematic ports as native off-sheet ports", async () => {
  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0] as AltiumSchDoc
  const sheetRecord = schematic.getRecordsByKind("31")[0]

  expect({
    fontIdCount: sheetRecord?.getNumber("FONTIDCOUNT"),
    portFontIds: [
      ...new Set(schematic.ports.map((port) => port.getNumber("FONTID"))),
    ],
    portFontName: sheetRecord?.getDecoded("FONTNAME3"),
    portFontSizePoints: sheetRecord?.getNumber("SIZE3"),
  }).toEqual({
    fontIdCount: 3,
    portFontIds: [3],
    portFontName: "Times New Roman",
    portFontSizePoints: 11,
  })
  expect(
    schematic.ports.map((port) => ({
      ioType: port.getNumber("IOTYPE"),
      name: port.name,
      position: port.position,
      style: port.getNumber("STYLE") ?? 0,
      width: port.getNumber("WIDTH"),
    })),
  ).toEqual([
    {
      ioType: 0,
      name: "UNSPECIFIED",
      position: { x: 120, y: 150 },
      style: 0,
      width: 88,
    },
    {
      ioType: 1,
      name: "INPUT",
      position: { x: 160, y: 150 },
      style: 0,
      width: 40,
    },
    {
      ioType: 2,
      name: "OUTPUT_SIGNAL",
      position: { x: 200, y: 150 },
      style: 0,
      width: 104,
    },
    {
      ioType: 3,
      name: "BIDIRECTIONAL",
      position: { x: 240, y: 150 },
      style: 0,
      width: 104,
    },
    {
      ioType: 2,
      name: "VERTICAL_OUTPUT",
      position: { x: 280, y: 150 },
      style: 4,
      width: 120,
    },
  ])
  expectValidSchematic(schematic)
})
