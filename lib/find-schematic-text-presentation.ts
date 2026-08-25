import { asPoint, sanitizeField } from "./format"
import type { CircuitElement, Point } from "./types"

type FindSchematicTextPresentationInput = {
  excludedTexts: ReadonlySet<CircuitElement>
  renderedText: string
  schematicTexts: CircuitElement[]
  targetPosition: Point
}

const MAXIMUM_TEXT_DISTANCE_CIRCUIT_UNITS = 0.05

export function findSchematicTextPresentation({
  excludedTexts,
  renderedText,
  schematicTexts,
  targetPosition,
}: FindSchematicTextPresentationInput): CircuitElement | undefined {
  const closestText = schematicTexts
    .filter(
      (schematicText) =>
        !excludedTexts.has(schematicText) &&
        schematicText.type === "schematic_text" &&
        sanitizeField(schematicText.text) === renderedText,
    )
    .map((schematicText) => {
      const position = asPoint(schematicText.position)
      return {
        distanceSquared: position
          ? (position.x - targetPosition.x) ** 2 +
            (position.y - targetPosition.y) ** 2
          : Number.POSITIVE_INFINITY,
        schematicText,
      }
    })
    .sort((left, right) => left.distanceSquared - right.distanceSquared)[0]

  return closestText &&
    closestText.distanceSquared <= MAXIMUM_TEXT_DISTANCE_CIRCUIT_UNITS ** 2
    ? closestText.schematicText
    : undefined
}
