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
    // Altium rejects a project without `[Design] Version=1.0` ("Unrecognized
    // Project File Version"). Each document carries the keys Altium itself
    // writes on save.
    const content = [
      "[Design]",
      "Version=1.0",
      "HierarchyMode=0",
      "ChannelRoomNamingStyle=0",
      "ReleasesFolder=",
      "ChannelDesignatorFormatString=$Component_$RoomName",
      "ChannelRoomLevelSeperator=_",
      "OpenOutputs=1",
      "ArchiveProject=0",
      "TimestampOutput=0",
      "SeparateFolders=0",
      "TemplateLocationPath=",
      "DefaultConfiguration=",
      `ProjectName=${this.context.safeProjectName}`,
      "",
      // Schematics must come before the PCB: with the PcbDoc listed first,
      // Altium 26 compiles the project but its flattened netlist is empty
      // (0 components, 0 nets), so validation and Update PCB see nothing.
      ...[
        ...this.context.schematics.map(({ filename }) => filename),
        this.context.pcb.filename,
      ].flatMap((path, index) => [
        `[Document${index + 1}]`,
        `DocumentPath=${path}`,
        "AnnotationEnabled=1",
        "AnnotateStartValue=1",
        "AnnotationIndexControlEnabled=0",
        "AnnotateSuffix=",
        "AnnotateScope=All",
        "AnnotateOrder=-1",
        "DoLibraryUpdate=1",
        "DoDatabaseUpdate=1",
        "ClassGenCCAutoEnabled=1",
        "ClassGenCCAutoRoomEnabled=1",
        "ClassGenNCAutoScope=None",
        "DItemRevisionGUID=",
        "GenerateClassCluster=0",
        "DocumentUniqueId=",
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
