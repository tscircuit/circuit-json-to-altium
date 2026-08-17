import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
} from "altiumts"
import { ConverterStage } from "../converter-stage"
import type { NormalizedCircuitJson } from "../types"

export class ValidateAltiumDocumentsStage extends ConverterStage<
  NormalizedCircuitJson,
  true
> {
  _step(): void {
    const { pcb, project, schematics } = this.context
    if (!pcb || !project || !schematics) {
      throw new Error("Every document stage must finish before validation")
    }

    parseAltiumPcbDoc(pcb.asciiContent, { mode: "strict" })
    parseAltiumBinaryPcbDoc(pcb.content)
    for (const schematic of schematics) {
      parseAltiumSchDoc(schematic.content)
    }
    parseAltiumPrjPcb(project.content)
    this.context.validated = true
    this.finished = true
  }

  getOutput(): true {
    if (!this.context.validated) {
      throw new Error("Altium document validation has not finished")
    }
    return true
  }
}
