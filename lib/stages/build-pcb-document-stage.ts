import { ConverterStage } from "../converter-stage"
import { createPcbDocument } from "../create-pcb-document"
import { serializeAltiumPcbDocWithBoardCutouts } from "../serialize-altium-pcb-doc-with-board-cutouts"
import type { AltiumPcbFile, NormalizedCircuitJson } from "../types"

export class BuildPcbDocumentStage extends ConverterStage<
  NormalizedCircuitJson,
  AltiumPcbFile
> {
  _step(): void {
    const asciiContent = createPcbDocument(this.input)
    this.context.pcb = {
      asciiContent,
      content: serializeAltiumPcbDocWithBoardCutouts(asciiContent),
      filename: `${this.context.safeProjectName}.PcbDoc`,
    }
    this.finished = true
  }

  getOutput(): AltiumPcbFile {
    if (!this.context.pcb) {
      throw new Error("PCB document stage has not finished")
    }
    return this.context.pcb
  }
}
