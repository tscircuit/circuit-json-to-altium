import { serializeAltiumSchDocToBinary } from "altiumts"
import { ConverterStage } from "../converter-stage"
import type { AltiumSchematicChildSheet } from "../create-altium-schematic-sheet-symbol-records"
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
    const childSheets: AltiumSchematicChildSheet[] = sheets.map(
      (sheet, index) => ({
        filename: `${this.context.safeProjectName}-${String(index + 1).padStart(2, "0")}.SchDoc`,
        name: asString(sheet.name) || `Sheet ${index + 1}`,
        schematicSheetId: asString(sheet.schematic_sheet_id),
        subcircuitId: asString(sheet.subcircuit_id) || undefined,
      }),
    )
    const documentDefinitions =
      childSheets.length === 0
        ? [
            {
              childSheets: [],
              filename: `${this.context.safeProjectName}.SchDoc`,
              includeAllSchematicElements: true,
              schematicSheetId: undefined,
            },
          ]
        : [
            {
              childSheets,
              filename: `${this.context.safeProjectName}.SchDoc`,
              includeAllSchematicElements: false,
              schematicSheetId: undefined,
            },
            ...childSheets.map((childSheet) => ({
              childSheets: [],
              filename: childSheet.filename,
              includeAllSchematicElements: false,
              schematicSheetId: childSheet.schematicSheetId,
            })),
          ]
    this.context.schematics = documentDefinitions.map((definition) => {
      const asciiContent = createSchematicDocument({
        childSheets: definition.childSheets,
        circuitJson: this.input,
        schematicSheetId: definition.schematicSheetId,
        includeAllSchematicElements: definition.includeAllSchematicElements,
      })
      return {
        asciiContent,
        content: serializeAltiumSchDocToBinary(asciiContent),
        filename: definition.filename,
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
