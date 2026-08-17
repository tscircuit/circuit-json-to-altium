import { ConverterStage } from "../converter-stage"
import type { AltiumProjectFile, NormalizedCircuitJson } from "../types"

export class BuildProjectDocumentStage extends ConverterStage<
  NormalizedCircuitJson,
  AltiumProjectFile
> {
  _step(): void {
    if (!this.context.pcb || !this.context.schematics) {
      throw new Error("PCB and schematic stages must finish before the project")
    }
    const content = [
      "[Design]",
      `ProjectName=${this.context.safeProjectName}`,
      "",
      ...[
        { path: this.context.pcb.filename, kind: "pcb-document" },
        ...this.context.schematics.map(({ filename }) => ({
          path: filename,
          kind: "schematic-document",
        })),
      ].flatMap((document, index) => [
        `[Document${index + 1}]`,
        `DocumentPath=${document.path}`,
        `DocumentKind=${document.kind}`,
        "",
      ]),
    ].join("\r\n")
    this.context.project = {
      content,
      filename: `${this.context.safeProjectName}.PrjPcb`,
    }
    this.finished = true
  }

  getOutput(): AltiumProjectFile {
    if (!this.context.project) {
      throw new Error("Project document stage has not finished")
    }
    return this.context.project
  }
}
