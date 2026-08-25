import { expect, test } from "bun:test"
import { board, type CircuitElement, extractArchive } from "./fixtures"

test("writes schematic sheet presentation as native fields", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_config",
      schematic_config_id: "schematic_config_main",
      show_border: true,
      show_title_block: true,
      show_reference_zones: true,
      border_margin: 1,
      horizontal_zone_count: 8,
      vertical_zone_count: 5,
    },
  ]

  const { schematics } = await extractArchive(elements)
  const sheetRecord = schematics[0]?.getRecordsByKind("31")[0]

  expect({
    borderMargin: sheetRecord?.getNumber("CUSTOMMARGINWIDTH"),
    borderOn: sheetRecord?.getBoolean("BORDERON"),
    horizontalZoneCount: sheetRecord?.getNumber("CUSTOMXZONES"),
    referenceZonesOn: sheetRecord?.getBoolean("REFERENCEZONESON"),
    titleBlockOn: sheetRecord?.getBoolean("TITLEBLOCKON"),
    verticalZoneCount: sheetRecord?.getNumber("CUSTOMYZONES"),
  }).toEqual({
    borderMargin: 20,
    borderOn: true,
    horizontalZoneCount: 8,
    referenceZonesOn: true,
    titleBlockOn: true,
    verticalZoneCount: 5,
  })
})
