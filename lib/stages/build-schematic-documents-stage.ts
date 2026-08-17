import { serializeAltiumSchDocToBinary } from "altiumts"
import { ConverterStage } from "../converter-stage"
import { createSchematicDocument } from "../create-schematic-document"
import { asNumber, asString, byType } from "../format"
import type { AltiumSchematicFile, NormalizedCircuitJson } from "../types"

export class BuildSchematicDocumentsStage extends ConverterStage<
  NormalizedCircuitJson,
  AltiumSchematicFile[]
> {
  _step(): void {
    const sheets = byType(this.input, "schematic_sheet").sort(
      (leftSheet, rightSheet) =>
        asNumber(leftSheet.sheet_index) - asNumber(rightSheet.sheet_index),
    )
    const sheetDefinitions = sheets.length > 0 ? sheets : [undefined]
    this.context.schematics = sheetDefinitions.map((sheet, index) => {
      const suffix =
        sheetDefinitions.length > 1
          ? `-${String(index + 1).padStart(2, "0")}`
          : ""
      const asciiContent = createSchematicDocument({
        circuitJson: this.input,
        schematicSheetId: sheet
          ? asString(sheet.schematic_sheet_id)
          : undefined,
        isFirstSchematicSheet: index === 0,
      })
      return {
        asciiContent,
        content: serializeAltiumSchDocToBinary(asciiContent),
        filename: `${this.context.safeProjectName}${suffix}.SchDoc`,
      }
    })
    this.finished = true
  }

  getOutput(): AltiumSchematicFile[] {
    if (!this.context.schematics) {
      throw new Error("Schematic document stage has not finished")
    }
    return this.context.schematics
  }
}
