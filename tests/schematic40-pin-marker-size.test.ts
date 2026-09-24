import { expect, test } from "bun:test"
import { getSchematicRecordPoints, serializeAltiumSheetToSvg } from "altiumts"
import { board, extractArchive, sourceComponent, sourcePort } from "./fixtures"
import {
  getRecordCorner,
  getRecordLocation,
} from "./fixtures/altium-schematic-coordinate-utils"
import { getHairlinePinStem } from "./fixtures/get-hairline-pin-stem"

function getSchematicCoordinate(
  record: { getNumber(key: string): number | undefined },
  key: string,
): number {
  return (
    (record.getNumber(key) ?? 0) +
    (record.getNumber(`${key}_FRAC`) ?? 0) / 100_000
  )
}

for (const [orientation, facing] of ["right", "up", "left", "down"].entries()) {
  test(`matches the Circuit JSON inversion bubble on the ${facing} side`, async () => {
    const dx = [1, 0, -1, 0][orientation]!
    const dy = [0, 1, 0, -1][orientation]!
    const doc = (
      await extractArchive([
        board(),
        sourceComponent("part", "U1"),
        sourcePort({
          sourcePortId: "pin",
          sourceComponentId: "part",
          pinNumber: 5,
        }),
        {
          type: "schematic_component",
          schematic_component_id: "body",
          source_component_id: "part",
          center: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          is_box_with_pins: true,
        },
        {
          type: "schematic_port",
          schematic_port_id: "port",
          schematic_component_id: "body",
          source_port_id: "pin",
          center: { x: 1.5 * dx, y: 1.5 * dy },
          distance_from_component_edge: 0.5,
          facing_direction: facing,
          pin_number: 5,
          display_pin_label: "INVERTED",
          is_drawn_with_inversion_circle: true,
        },
      ])
    ).schematics[0]!
    const pin = doc.pins[0]!
    const bubble = doc.records.find((r) => r.recordKind === "8")!
    const radius = 0.06 * 20
    expect(getSchematicCoordinate(bubble, "RADIUS")).toBeCloseTo(radius)
    expect(getSchematicCoordinate(bubble, "SECONDARYRADIUS")).toBeCloseTo(
      radius,
    )
    expect(bubble.getBoolean("ISSOLID")).toBe(true)
    expect(bubble.getNumber("AREACOLOR")).toBe(0xffffff)
    expect(bubble.getNumber("LINEWIDTH")).toBe(0)
    expect(bubble.getNumber("OWNERINDEX")).toBe(pin.getNumber("OWNERINDEX"))
    expect(pin.getNumber("SYMBOL_OUTEREDGE")).toBeUndefined()
    expect(pin.getNumber("PINLENGTH")).toBe(0)
    const center = {
      x: getSchematicCoordinate(bubble, "LOCATION.X"),
      y: getSchematicCoordinate(bubble, "LOCATION.Y"),
    }
    const body = { x: center.x - dx * radius, y: center.y - dy * radius }
    expect(pin.position!.x).toBeCloseTo(body.x + dx * 10)
    expect(pin.position!.y).toBeCloseTo(body.y + dy * 10)
    const stem = getHairlinePinStem(doc, pin)!
    const wire = [getRecordLocation(stem), getRecordCorner(stem)]
    expect(wire[0]!.x).toBeCloseTo(body.x + dx * 2.4)
    expect(wire[0]!.y).toBeCloseTo(body.y + dy * 2.4)
    expect(wire[1]).toEqual(pin.position!)
    expect(wire[1]!.x).toBeCloseTo(body.x + dx * 10)
    expect(wire[1]!.y).toBeCloseTo(body.y + dy * 10)
    // Moving the electrical terminal must not move either text anchor.
    expect(
      getSchematicCoordinate(pin, "NAME_CUSTOMPOSITION_MARGIN") - 10,
    ).toBeCloseTo(0)
    expect(
      getSchematicCoordinate(pin, "DESIGNATOR_CUSTOMPOSITION_MARGIN") + 10,
    ).toBeCloseTo(3)
    const svg = serializeAltiumSheetToSvg(doc)
    expect(svg).toContain('rx="1.2" ry="1.2" fill="#ffffff"')
    expect(svg).not.toContain("altium-schematic-pin-inversion-symbol")
  })
}

for (const [orientation, facing] of ["right", "up", "left", "down"].entries()) {
  for (const kind of ["input", "output", "bidirectional"]) {
    for (const inverted of [false, true]) {
      test(`exports a filled ${kind} arrow facing ${facing}, inverted=${inverted}`, async () => {
        const dx = [1, 0, -1, 0][orientation]!
        const dy = [0, 1, 0, -1][orientation]!
        const doc = (
          await extractArchive([
            board(),
            sourceComponent("part", "U1"),
            sourcePort({
              sourcePortId: "pin",
              sourceComponentId: "part",
              pinNumber: 5,
            }),
            {
              type: "schematic_component",
              schematic_component_id: "body",
              source_component_id: "part",
              center: { x: 0, y: 0 },
              size: { width: 2, height: 2 },
              is_box_with_pins: true,
            },
            {
              type: "schematic_port",
              schematic_port_id: "port",
              schematic_component_id: "body",
              source_port_id: "pin",
              center: { x: 1.5 * dx, y: 1.5 * dy },
              distance_from_component_edge: 0.5,
              facing_direction: facing,
              pin_number: 5,
              display_pin_label: "SIGNAL",
              has_input_arrow: kind !== "output",
              has_output_arrow: kind !== "input",
              is_drawn_with_inversion_circle: inverted,
            },
          ])
        ).schematics[0]!
        const pin = doc.pins[0]!
        const center = doc.components[0]!.position!
        const body = { x: center.x + dx * 20, y: center.y + dy * 20 }
        const local = (point: { x: number; y: number }) => ({
          along: (point.x - body.x) * dx + (point.y - body.y) * dy,
          across: -(point.x - body.x) * dy + (point.y - body.y) * dx,
        })
        const polygons = doc.records.filter((r) => r.recordKind === "7")
        expect(polygons).toHaveLength(kind === "bidirectional" ? 2 : 1)
        // circuit-to-svg: side length 0.1, a 30-degree half-angle, scale 20.
        const depth = Math.sqrt(3)
        const bubbleEnd = inverted ? 2.4 : 0
        const expected =
          kind === "input"
            ? [
                [
                  [0, 0],
                  [depth, 1],
                  [depth, -1],
                ],
              ]
            : kind === "output"
              ? [
                  [
                    [2, 0],
                    [2 - depth, 1],
                    [2 - depth, -1],
                  ],
                ]
              : [
                  [
                    [0, 0],
                    [depth, 1],
                    [depth, -1],
                  ],
                  [
                    [2 + depth, 0],
                    [2, 1],
                    [2, -1],
                  ],
                ]
        let outerEdge = 0
        for (const [index, polygon] of polygons.entries()) {
          expect(polygon.getBoolean("ISSOLID")).toBe(true)
          expect(polygon.getNumber("AREACOLOR")).toBe(0xffffff)
          expect(polygon.getNumber("LINEWIDTH")).toBe(0)
          expect(polygon.getNumber("OWNERINDEX")).toBe(
            pin.getNumber("OWNERINDEX"),
          )
          const points = getSchematicRecordPoints(polygon).map(local)
          expect(points).toHaveLength(3)
          for (const [i, p] of points.entries()) {
            expect(p.along).toBeCloseTo(expected[index]![i]![0]! + bubbleEnd, 4)
            expect(p.across).toBeCloseTo(expected[index]![i]![1]!, 4)
            outerEdge = Math.max(outerEdge, p.along)
          }
        }
        const terminalOffset = outerEdge
        const stem = getHairlinePinStem(doc, pin)!
        const [start, end] = [
          getRecordLocation(stem),
          getRecordCorner(stem),
        ].map(local)
        // The wire meets the marker's exposed stem, never its filled interior.
        expect(start!.along).toBeCloseTo(terminalOffset, 4)
        expect(start!.across).toBeCloseTo(0, 4)
        expect(end!.along).toBeCloseTo(10, 4)
        expect(end!.across).toBeCloseTo(0, 4)
        expect(local(pin.position!).along).toBeCloseTo(10, 4)
        expect(
          getSchematicCoordinate(pin, "NAME_CUSTOMPOSITION_MARGIN") - 10,
        ).toBeCloseTo(0, 4)
        expect(
          getSchematicCoordinate(pin, "DESIGNATOR_CUSTOMPOSITION_MARGIN") + 10,
        ).toBeCloseTo(3, 4)
        expect(pin.getNumber("ELECTRICAL")).toBe(4)
        const filledIntervals = expected.map((points) => [
          Math.min(...points.map((p) => p[0]!)) + bubbleEnd,
          Math.max(...points.map((p) => p[0]!)) + bubbleEnd,
        ])
        if (inverted) filledIntervals.push([0, bubbleEnd])
        for (const line of doc.records.filter((r) => r.recordKind === "13")) {
          const points = ["LOCATION", "CORNER"].map((prefix) =>
            local({
              x: getSchematicCoordinate(line, `${prefix}.X`),
              y: getSchematicCoordinate(line, `${prefix}.Y`),
            }),
          )
          const lo = Math.min(...points.map((p) => p.along))
          const hi = Math.max(...points.map((p) => p.along))
          for (const [a, b] of filledIntervals) {
            expect(hi <= a! + 1e-4 || lo >= b! - 1e-4).toBe(true)
          }
        }
        const svg = serializeAltiumSheetToSvg(doc)
        expect(svg).not.toContain("altium-schematic-pin-electrical-symbol")
        expect(svg).not.toContain("altium-schematic-pin-clock-symbol")
      })
    }
  }
}
