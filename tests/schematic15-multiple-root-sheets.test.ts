import { expect, test } from "bun:test"
import { board, type CircuitElement, extractArchive } from "./fixtures"

test("rejects multiple root schematic sheets", async () => {
  const elements: CircuitElement[] = [
    board(),
    {
      type: "schematic_sheet",
      schematic_sheet_id: "first-root-sheet",
      is_root: true,
    },
    {
      type: "schematic_sheet",
      schematic_sheet_id: "second-root-sheet",
      is_root: true,
    },
  ]

  await expect(extractArchive(elements)).rejects.toThrow(
    "Circuit JSON defines 2 root schematic sheets; expected at most one",
  )
})
