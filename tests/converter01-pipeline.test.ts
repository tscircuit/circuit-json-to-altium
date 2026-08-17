import { expect, test } from "bun:test"
import { CircuitJsonToAltiumConverter } from "../lib"

test("runs the Altium conversion pipeline one inspectable stage at a time", () => {
  const converter = new CircuitJsonToAltiumConverter(
    [{ type: "pcb_board", width: 20, height: 12 }],
    { projectName: "pipeline-board" },
  )
  const stageNames: string[] = []

  while (!converter.finished) {
    const currentStage = converter.currentStage
    if (currentStage && currentStage.iteration === 0) {
      stageNames.push(currentStage.constructor.name)
    }
    converter.step()
  }

  expect(stageNames).toEqual([
    "BuildPcbDocumentStage",
    "BuildSchematicDocumentsStage",
    "BuildProjectDocumentStage",
    "ValidateAltiumDocumentsStage",
  ])
  expect(converter.getOutput().project.filename).toBe("pipeline-board.PrjPcb")
})
