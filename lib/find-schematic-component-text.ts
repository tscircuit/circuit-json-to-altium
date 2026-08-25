import { sanitizeField } from "./format"
import type { CircuitElement } from "./types"

type FindSchematicComponentTextInput = {
  componentTexts: CircuitElement[]
  excludedText: CircuitElement | undefined
  renderedText: string
}

export function findSchematicComponentText({
  componentTexts,
  excludedText,
  renderedText,
}: FindSchematicComponentTextInput): CircuitElement | undefined {
  if (!renderedText) return undefined
  return componentTexts.find(
    (componentText) =>
      componentText !== excludedText &&
      componentText.type === "schematic_text" &&
      sanitizeField(componentText.text) === renderedText,
  )
}
