import type { AltiumSchComponentRecord, AltiumSchDoc } from "altiumts"

export function resolveAltiumComponentParameterText({
  component,
  document,
  parameterReference,
}: {
  component: AltiumSchComponentRecord
  document: AltiumSchDoc
  parameterReference: string
}): string {
  const visitedParameterNames = new Set<string>()
  let resolvedText = parameterReference

  while (resolvedText.startsWith("=") && resolvedText.length > 1) {
    const parameterName = resolvedText.slice(1).trim().toLowerCase()
    if (!parameterName || visitedParameterNames.has(parameterName)) break
    visitedParameterNames.add(parameterName)

    const referencedParameter = document
      .getOwnedRecords(component)
      .find(
        (record) =>
          (record.recordKind === "34" || record.recordKind === "41") &&
          record.getDecoded("NAME")?.trim().toLowerCase() === parameterName,
      )
    const referencedText = referencedParameter?.getDecoded("TEXT")
    if (!referencedText || referencedText === resolvedText) break
    resolvedText = referencedText
  }

  return resolvedText
}
