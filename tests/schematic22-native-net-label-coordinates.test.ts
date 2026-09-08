import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "altiumts"
import { createAltiumSchematicCoordinateFields } from "../lib/create-altium-schematic-coordinate-fields"
import { createAltiumSchematicFontTable } from "../lib/create-altium-schematic-font-table"
import { createAltiumSchematicNetLabelRecordFields } from "../lib/create-altium-schematic-net-label-record-fields"

const fontTable = createAltiumSchematicFontTable({
  schematicElements: [{ type: "schematic_net_label" }],
})

function document(records: string[][]) {
  return parseAltiumSchDoc(
    serializeAltiumSchDocToBinary(
      [
        "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
        "|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=400|CUSTOMY=300",
        ...records.map((fields) => `|${fields.join("|")}`),
      ].join("\n"),
    ),
  )
}

test("serializes fractional native label anchors without decimal base fields", () => {
  const doc = document(
    createAltiumSchematicNetLabelRecordFields({
      anchorSide: "left",
      altiumLabelPosition: { x: 258.08, y: 100.25 },
      fontTable,
      labelText: "U1_VCORE",
      symbolName: "",
      textPresentation: undefined,
    }),
  )
  const label = doc.netLabels[0]!
  expect(label.getCaseInsensitive("LOCATION.X")).toBe("258")
  expect(label.getCaseInsensitive("LOCATION.X_FRAC")).toBe("8000")
  expect(label.getCaseInsensitive("LOCATION.Y_FRAC")).toBe("25000")
  expect(doc.getRecordsByKind("4")).toHaveLength(0)
  const svg = serializeAltiumSheetToSvg(doc, { margin: 0 })
  expect(svg).toContain("translate(258.08 199.75)")
})

test("exports only integer coordinate tokens for every label direction and power ports", () => {
  for (const anchorSide of ["left", "right", "top", "bottom"]) {
    for (const symbolName of ["", "rail_up", "ground_down"]) {
      const doc = document(
        createAltiumSchematicNetLabelRecordFields({
          anchorSide,
          altiumLabelPosition: { x: -12.08, y: -0.00005 },
          fontTable,
          labelText: "SIGNAL",
          symbolName,
          textPresentation: undefined,
        }),
      )
      for (const record of doc.records) {
        for (const field of record.fields) {
          if (/^(?:LOCATION\.[XY]|[XY]\d+)(?:_FRAC)?$/u.test(field.key)) {
            expect(field.value).toMatch(/^-?\d+$/u)
          }
        }
      }
      const anchor = (doc.netLabels[0] ?? doc.powerPorts[0])!
      expect(anchor.getCaseInsensitive("LOCATION.X")).toBe("-12")
      expect(anchor.getCaseInsensitive("LOCATION.X_FRAC")).toBe("-8000")
      expect(anchor.getCaseInsensitive("LOCATION.Y")).toBe("0")
      expect(anchor.getCaseInsensitive("LOCATION.Y_FRAC")).toBe("-5")
    }
  }
})

test("carries rounded fractions and retains small signed values through binary serialization", () => {
  const doc = document([
    [
      "RECORD=6",
      "LOCATIONCOUNT=3",
      ...createAltiumSchematicCoordinateFields("X1", 1.999999),
      ...createAltiumSchematicCoordinateFields("Y1", -1.999999),
      ...createAltiumSchematicCoordinateFields("X2", 0.00005),
      ...createAltiumSchematicCoordinateFields("Y2", -0.00005),
      ...createAltiumSchematicCoordinateFields("X3", 20),
      ...createAltiumSchematicCoordinateFields("Y3", 30),
    ],
  ])
  const line = doc.getRecordsByKind("6")[0]!
  expect(line.getCaseInsensitive("X1")).toBe("2")
  expect(line.getCaseInsensitive("Y1")).toBe("-2")
  expect(line.getCaseInsensitive("X1_FRAC")).toBeUndefined()
  expect(line.getCaseInsensitive("X2_FRAC")).toBe("5")
  expect(line.getCaseInsensitive("Y2_FRAC")).toBe("-5")
})
