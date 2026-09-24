import { createAltiumSchematicCoordinateFields } from "./create-altium-schematic-coordinate-fields"

/**
 * Layout uses 20 units per Circuit JSON unit. Native Altium's smallest junction
 * has a fixed radius of 2 units: exporting at 200/3 units makes that radius 0.03,
 * matching Circuit JSON. Scale after layout so grid snapping and font aliases
 * remain consistent with existing schematics.
 */
export const SCHEMATIC_EXPORT_SCALE = 10 / 3

const coordinateFields = new Set([
  "RADIUS",
  "SECONDARYRADIUS",
  "PINLENGTH",
  "WIDTH",
  "HEIGHT",
  "XSIZE",
  "YSIZE",
  "DISTANCEFROMTOP",
  "DESIGNATOR_CUSTOMPOSITION_MARGIN",
  "NAME_CUSTOMPOSITION_MARGIN",
])

/** Scale dimensional fields only; record IDs, owners and native size enums stay intact. */
export function scaleSchematicExport(ascii: string): string {
  return ascii.replace(/[^\r\n]+/gu, (line) => {
    const fields = line.split("|")
    const values = new Map<string, string>()
    for (const field of fields) {
      const separator = field.indexOf("=")
      if (separator !== -1) {
        values.set(
          field.slice(0, separator).toUpperCase(),
          field.slice(separator + 1),
        )
      }
    }
    const scaledCoordinates = new Set(
      [...values.keys()].filter(
        (key) =>
          /^(LOCATION|CORNER)\.[XY]$/u.test(key) ||
          /^[XY]\d+$/u.test(key) ||
          coordinateFields.has(key),
      ),
    )
    return fields
      .flatMap((field) => {
        const separator = field.indexOf("=")
        if (separator === -1) return [field]
        const key = field.slice(0, separator)
        const upperKey = key.toUpperCase()
        if (
          upperKey.endsWith("_FRAC") &&
          scaledCoordinates.has(upperKey.slice(0, -5))
        )
          return []
        const value = Number(field.slice(separator + 1))
        if (!Number.isFinite(value)) return [field]
        if (scaledCoordinates.has(upperKey)) {
          const coordinate =
            value + Number(values.get(`${upperKey}_FRAC`) ?? 0) / 100000
          // Native pin names add a fixed 2-unit inset before the custom margin.
          const scaled =
            upperKey === "NAME_CUSTOMPOSITION_MARGIN"
              ? (coordinate + 2) * SCHEMATIC_EXPORT_SCALE - 2
              : coordinate * SCHEMATIC_EXPORT_SCALE
          return createAltiumSchematicCoordinateFields(key, scaled)
        }
        if (
          /^(SIZE\d+|CUSTOM[XY]|SNAPGRIDSIZE|VISIBLEGRIDSIZE|HOTSPOTGRIDSIZE)$/u.test(
            upperKey,
          )
        ) {
          return [`${key}=${Math.ceil(value * SCHEMATIC_EXPORT_SCALE)}`]
        }
        return [field]
      })
      .join("|")
  })
}
