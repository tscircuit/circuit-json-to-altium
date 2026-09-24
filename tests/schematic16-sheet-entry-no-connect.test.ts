import { expect, test } from "bun:test"
import { AltiumSchNoErcRecord } from "altiumts"
import { board, type CircuitElement, extractArchive } from "./fixtures"

const ALTIUM_SHEET_ENTRY_DISTANCE_UNIT = 10

const elements: CircuitElement[] = [
  board(),
  {
    type: "schematic_sheet",
    schematic_sheet_id: "schematic_sheet_child",
    sheet_index: 0,
  },
  {
    type: "source_port",
    source_port_id: "source_port_no_connect",
    name: "UNUSED",
    do_not_connect: true,
  },
  {
    type: "schematic_port",
    schematic_port_id: "schematic_port_no_connect",
    schematic_sheet_id: "schematic_sheet_child",
    source_port_id: "source_port_no_connect",
    center: { x: 4, y: 2 },
    facing_direction: "right",
  },
]

test("writes a sheet-entry do-not-connect marker at its native Altium position", async () => {
  const result = await extractArchive(elements, "sheet-entry-no-connect")
  const rootSchematicIndex = result.schematicSources.findIndex(
    ({ filename }) => filename === "sheet-entry-no-connect.SchDoc",
  )
  const rootSchematic = result.schematics[rootSchematicIndex]
  const sheetLink = rootSchematic?.sheetLinks[0]
  const sheetSymbolPosition = sheetLink?.symbol.position
  const sheetEntry = sheetLink
    ? rootSchematic
        .getOwnedRecords(sheetLink.symbol)
        .find((record) => record.recordKind === "16")
    : undefined
  const noConnectRecord = rootSchematic?.getRecordsByKind("22")[0]
  if (
    !sheetLink ||
    !sheetSymbolPosition ||
    !sheetEntry ||
    !(noConnectRecord instanceof AltiumSchNoErcRecord)
  ) {
    throw new Error("Expected a sheet entry with a No ERC marker")
  }

  const sheetSymbolWidth = sheetLink.symbol.getNumber("XSIZE") ?? 0
  const entrySide = sheetEntry.getNumber("SIDE") ?? 0
  const entryDistanceFromTop = sheetEntry.getNumber("DISTANCEFROMTOP") ?? 0
  expect(noConnectRecord.position).toEqual({
    x: sheetSymbolPosition.x + (entrySide === 1 ? sheetSymbolWidth : 0),
    y:
      sheetSymbolPosition.y -
      entryDistanceFromTop * ALTIUM_SHEET_ENTRY_DISTANCE_UNIT,
  })
  expect(rootSchematic.getRecordsByKind("22")).toHaveLength(1)
})
