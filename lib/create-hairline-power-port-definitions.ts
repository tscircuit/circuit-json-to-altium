import { parseAltiumSchDoc } from "altiumts"
import { createAltiumSchematicCoordinateFields } from "./create-altium-schematic-coordinate-fields"

export function getHairlinePowerPortDefinitionId(
  style: number,
  color: number,
): string {
  return `{6DC32C5D-B174-46EC-${style.toString(16).padStart(4, "0")}-${color.toString(16).padStart(12, "0")}}`.toUpperCase()
}

/** Native power ports retain their global-net semantics and native text. */
export function createHairlinePowerPortDefinitions(
  asciiContent: string,
): string[] {
  const definitions: string[] = []
  const seen = new Set<string>()
  for (const port of parseAltiumSchDoc(asciiContent).powerPorts) {
    const id = port.getCaseInsensitive("ObjectDefinitionId")
    if (!id || seen.has(id)) continue
    const color = port.getNumber("COLOR") ?? 132
    const style = port.getNumber("STYLE")
    if (
      (style !== 2 && style !== 4) ||
      id !== getHairlinePowerPortDefinitionId(style, color)
    )
      continue
    seen.add(id)
    const owner = definitions.length
    definitions.push(
      `|RECORD=129|ObjectDefinitionId=${id}|LibReference=HairlinePower${style}|PartCount=2|CurrentPartId=1|DisplayModeCount=1|Location.X=0|Location.Y=0|OwnerPartId=-1`,
    )
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      definitions.push(
        `|RECORD=13|OwnerIndex=${owner}|OwnerPartId=-1|${[...createAltiumSchematicCoordinateFields("Location.X", x1), ...createAltiumSchematicCoordinateFields("Location.Y", y1), ...createAltiumSchematicCoordinateFields("Corner.X", x2), ...createAltiumSchematicCoordinateFields("Corner.Y", y2)].join("|")}|LineWidth=0|Color=${color}`,
      )
    }
    if (style === 2) {
      line(0, 0, 10, 0)
      line(10, -5, 10, 5)
    } else if (style === 4) {
      line(0, 0, 4, 0)
      line(4, -7, 4, 7)
      line(8, -4.5, 8, 4.5)
      line(12, -2, 12, 2)
    }
  }
  return definitions
}
