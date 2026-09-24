import { expect, test } from "bun:test"
import { parseAltiumSchDoc } from "altiumts"
import { scaleSchematicExport } from "../lib/scale-schematic-export"
import { getSchematicCoordinate } from "./fixtures/altium-schematic-coordinate-utils"

test("scales dimensional fields without changing native junction enums, ownership or text", () => {
  const scaled = scaleSchematicExport(
    [
      "|RECORD=31|CUSTOMX=686|CUSTOMY=562|SIZE1=4|SIZE2=3|FONTNAME1=Arial|SNAPGRIDSIZE=10",
      "|RECORD=29|LOCATION.X=12|LOCATION.Y=0|LOCATION.Y_FRAC=-15000|SIZE=0|COLOR=34816|LOCKED=T|INDEXINSHEET=1",
      "|RECORD=2|OWNERINDEX=3|LOCATION.X=30|LOCATION.Y=0|PINLENGTH=0|NAME_CUSTOMPOSITION_MARGIN=10|DESIGNATOR_CUSTOMPOSITION_MARGIN=-7|PINCONGLOMERATE=57|NAME=Vµ|DESIGNATOR=5",
      "|RECORD=15|LOCATION.X=0|LOCATION.Y=60|XSIZE=160|YSIZE=60",
      "|RECORD=16|OWNERINDEX=3|DISTANCEFROMTOP=1|SIDE=1|IOTYPE=2",
      "|RECORD=8|OWNERINDEX=3|LOCATION.X=0|LOCATION.Y=0|RADIUS=1|RADIUS_FRAC=20000|SECONDARYRADIUS=1|SECONDARYRADIUS_FRAC=20000|LINEWIDTH=0|ISSOLID=T|AREACOLOR=16777215",
    ].join("\r\n"),
  )
  const doc = parseAltiumSchDoc(scaled)
  const sheet = doc.getRecordsByKind("31")[0]!
  expect(sheet.getNumber("CUSTOMX")).toBe(2287)
  expect(sheet.getNumber("CUSTOMY")).toBe(1874)
  expect(sheet.getNumber("SIZE1")).toBe(14)
  expect(sheet.getNumber("SIZE2")).toBe(10)
  const junction = doc.getRecordsByKind("29")[0]!
  expect(getSchematicCoordinate({ record: junction, key: "LOCATION.X" })).toBe(
    40,
  )
  expect(scaled).toContain("LOCATION.Y=0|LOCATION.Y_FRAC=-50000")
  expect(junction.getNumber("SIZE")).toBe(0)
  expect(junction.getNumber("COLOR")).toBe(34816)
  expect(junction.getBoolean("LOCKED")).toBe(true)
  expect(junction.getNumber("INDEXINSHEET")).toBe(1)
  const pin = doc.pins[0]!
  const margin = (key: string) =>
    Number(pin.getNumber(key)) +
    Number(pin.getNumber(`${key}_FRAC`) ?? 0) / 100000
  expect(
    (margin("NAME_CUSTOMPOSITION_MARGIN") + 2 - 100 / 3) / (200 / 3),
  ).toBeCloseTo(0.1, 6)
  expect(
    (margin("DESIGNATOR_CUSTOMPOSITION_MARGIN") + 100 / 3) / (200 / 3),
  ).toBeCloseTo(0.15, 6)
  expect(pin.getNumber("OWNERINDEX")).toBe(3)
  expect(pin.getNumber("PINCONGLOMERATE")).toBe(57)
  expect(pin.getDecoded("NAME")).toBe("Vµ")
  expect(pin.getNumber("PINLENGTH")).toBe(0)
  expect(doc.getRecordsByKind("16")[0]!.getNumber("DISTANCEFROMTOP")).toBe(3)
  expect(doc.getRecordsByKind("16")[0]!.getNumber("DISTANCEFROMTOP_FRAC")).toBe(
    33333,
  )
  expect(doc.getRecordsByKind("8")[0]!.getNumber("RADIUS")).toBe(4)
  expect(doc.getRecordsByKind("8")[0]!.getNumber("LINEWIDTH")).toBe(0)
  // Measured native Smallest radius: 2 units, now 0.03 in Circuit JSON.
  expect(2 / (200 / 3)).toBeCloseTo(0.03, 10)
})

test("scales custom power graphics with signed fractions and preserves definition IDs", () => {
  const id = "{6DC32C5D-B174-46EC-0004-000000000084}"
  const result = scaleSchematicExport(
    `|RECORD=129|ObjectDefinitionId=${id}|OwnerPartId=-1\n|RECORD=13|OwnerIndex=0|Location.X=8|Location.Y=-4|Location.Y_FRAC=-50000|Corner.X=8|Corner.Y=4|Corner.Y_FRAC=50000|LineWidth=0|Color=132`,
  )
  expect(result).toContain(`ObjectDefinitionId=${id}`)
  expect(result).toContain("Location.X=26|Location.X_FRAC=66667")
  expect(result).toContain("Location.Y=-15")
  expect(result).toContain("Corner.Y=15")
  expect(result).toContain("OwnerIndex=0")
  expect(result).toContain("LineWidth=0|Color=132")
})

test("exports matching ASCII/binary dimensions and scaled native power definitions", async () => {
  const { CircuitJsonToAltiumConverter } = await import("../lib")
  const converter = new CircuitJsonToAltiumConverter([
    {
      type: "schematic_net_label",
      schematic_net_label_id: "ground",
      source_net_id: "gnd",
      text: "GND",
      center: { x: 0, y: 0 },
      anchor_position: { x: 0, y: 0 },
      symbol_name: "ground_down",
    },
  ])
  converter.runUntilFinished()
  const output = converter.getOutput().schematics[0]!
  const ascii = parseAltiumSchDoc(output.asciiContent)
  const binary = parseAltiumSchDoc(output.content)
  expect(ascii.powerPorts.map((r) => r.position)).toEqual(
    binary.powerPorts.map((r) => r.position),
  )
  expect(binary.getRecordsByKind("31")[0]!.getNumber("CUSTOMX")).toBe(1334)
  const port = binary.powerPorts[0]!
  const graphics = binary.getObjectDefinitionGraphics(
    port.getCaseInsensitive("ObjectDefinitionId")!,
  )!
  expect(graphics).toHaveLength(4)
  const stem = graphics[0]!
  expect(getSchematicCoordinate({ record: stem, key: "Corner.X" })).toBeCloseTo(
    40 / 3,
    4,
  )
  for (const record of graphics) expect(record.getNumber("LineWidth")).toBe(0)
})
