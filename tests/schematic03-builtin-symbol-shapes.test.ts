import { expect, test } from "bun:test"
import { type AltiumRecord, getSchematicRecordPoints } from "altiumts"
import {
  board,
  type CircuitElement,
  expectValidSchematic,
  extractArchive,
  sourceComponent,
} from "./fixtures"

const getGraphicRecordKinds = (ownedRecords: AltiumRecord[]): string[] =>
  ownedRecords.flatMap((record) =>
    record.recordKind && ["6", "7", "8", "14"].includes(record.recordKind)
      ? [record.recordKind]
      : [],
  )

test("converts built-in resistor and capacitor symbols to native paths", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("source_resistor", "R1"),
    sourceComponent("source_capacitor", "C1"),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_resistor",
      source_component_id: "source_resistor",
      center: { x: 0, y: 0 },
      size: { width: 0.6, height: 0.65 },
      symbol_name: "boxresistor_right",
      symbol_display_value: "1kΩ",
    },
    {
      type: "schematic_component",
      schematic_component_id: "schematic_capacitor",
      source_component_id: "source_capacitor",
      center: { x: 2, y: 0 },
      size: { width: 0.6, height: 0.65 },
      symbol_name: "capacitor_right",
      symbol_display_value: "1uF",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const resistor = schematic.components.find(
    (component) => component.libraryReference === "boxresistor_right",
  )
  const capacitor = schematic.components.find(
    (component) => component.libraryReference === "capacitor_right",
  )
  if (!resistor || !capacitor) {
    throw new Error("Expected generated resistor and capacitor components")
  }

  const resistorRecords = schematic.getOwnedRecords(resistor)
  const capacitorRecords = schematic.getOwnedRecords(capacitor)
  const resistorFirstPath = resistorRecords.find(
    (record) => record.recordKind === "6",
  )
  const resistorDesignator = resistorRecords.find(
    (record) => record.get("NAME") === "Designator",
  )
  const resistorComment = resistorRecords.find(
    (record) => record.get("NAME") === "Comment",
  )

  expect(getGraphicRecordKinds(resistorRecords)).toEqual(["6", "6", "6"])
  expect(getGraphicRecordKinds(capacitorRecords)).toEqual(["6", "6", "6", "6"])
  expect(resistorFirstPath?.getNumber("X1")).toBe(174)
  expect(resistorFirstPath?.getNumber("X2")).toBe(176)
  expect(resistorDesignator?.getNumber("LOCATION.X")).toBe(180)
  expect(resistorDesignator?.getNumber("LOCATION.Y")).toBe(153)
  expect(resistorDesignator?.getNumber("JUSTIFICATION")).toBe(1)
  expect(resistorComment?.getNumber("LOCATION.X")).toBe(180)
  expect(resistorComment?.getNumber("LOCATION.Y")).toBe(147)
  expect(resistorComment?.getNumber("JUSTIFICATION")).toBe(7)
  expectValidSchematic(schematic)
})

test("preserves sub-grid path details in built-in LED arrows", async () => {
  const elements: CircuitElement[] = [
    board(),
    sourceComponent("source_led", "D1"),
    {
      type: "schematic_component",
      schematic_component_id: "schematic_led",
      source_component_id: "source_led",
      center: { x: 0, y: 0 },
      size: { width: 0.62, height: 1.08 },
      symbol_name: "led_down",
      symbol_display_value: "Green",
    },
  ]

  const { schematics } = await extractArchive(elements)
  const schematic = schematics[0]
  if (!schematic) throw new Error("Expected one generated schematic")
  const led = schematic.components.find(
    (component) => component.libraryReference === "led_down",
  )
  if (!led) throw new Error("Expected a generated LED component")

  const arrowShaft = schematic
    .getOwnedRecords(led)
    .filter((record) => record.recordKind === "6")
    .find((record) => {
      const points = getSchematicRecordPoints(record)
      const lastPoint = points.at(-1)
      const previousPoint = points.at(-2)
      return (
        points.length === 4 &&
        lastPoint?.x === previousPoint?.x &&
        lastPoint?.y === previousPoint?.y
      )
    })
  if (!arrowShaft) throw new Error("Expected an LED arrow shaft")
  const [arrowStart, nextArrowPoint] = getSchematicRecordPoints(arrowShaft)
  if (!arrowStart || !nextArrowPoint) {
    throw new Error("Expected the LED arrow shaft to contain two points")
  }

  expect(
    Math.hypot(
      nextArrowPoint.x - arrowStart.x,
      nextArrowPoint.y - arrowStart.y,
    ),
  ).toBeCloseTo(0.2, 8)
  expect(arrowShaft.fields.some(({ key }) => key.endsWith("_FRAC"))).toBe(true)
  expectValidSchematic(schematic)
})
