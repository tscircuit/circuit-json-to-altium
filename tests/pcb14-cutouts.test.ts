import { describe, expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "altiumts"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { createPcbDocument } from "../lib/create-pcb-document"
import { board, type CircuitElement, expectValidPcb } from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

describe("PCB board cutouts", () => {
  test("exports rect, circle, polygon, and path cutouts as native Altium board cutout regions", async () => {
    const circuitJson: CircuitElement[] = [
      board({ width: 25, height: 25 }),
      {
        type: "pcb_cutout",
        pcb_cutout_id: "cutout_rect",
        shape: "rect",
        center: { x: -6, y: 5 },
        width: 4,
        height: 3,
      },
      {
        type: "pcb_cutout",
        pcb_cutout_id: "cutout_circle",
        shape: "circle",
        center: { x: 6, y: 5 },
        radius: 1.5,
      },
      {
        type: "pcb_cutout",
        pcb_cutout_id: "cutout_polygon",
        shape: "polygon",
        points: [
          { x: -5, y: -4 },
          { x: -1, y: -4 },
          { x: -3, y: -1 },
        ],
      },
      {
        type: "pcb_cutout",
        pcb_cutout_id: "cutout_path",
        shape: "path",
        route: [
          { x: 2, y: -4 },
          { x: 6, y: -4 },
          { x: 6, y: -1 },
          { x: 2, y: -1 },
        ],
        slot_width: 0.8,
      },
    ]

    const doc = createPcbDocument(circuitJson)
    const cutoutRecords = doc
      .split("\r\n")
      .filter((line) => line.includes("REGIONKIND=BOARDCUTOUT"))

    expect(cutoutRecords).toHaveLength(4)
    for (const record of cutoutRecords) {
      expect(record).toContain("|RECORD=Region|")
      expect(record).toContain("|LAYER=MULTILAYER|")
      expect(record).toContain("|LOCKED=FALSE|")
      expect(record).toContain("|KEEPOUT=FALSE|")
      expect(record).toContain("|TEARDROP=FALSE|")
      expect(record).toContain("|REGIONKIND=BOARDCUTOUT|")
      expect(record).toContain("|HOLECOUNT=0|")
      expect(record).toContain("|KIND0=0|")
    }

    const altiumPcb = parseAltiumPcbDoc(doc)
    const regions = altiumPcb.getRecordsByKind("Region")
    expect(regions).toHaveLength(4)
    for (const region of regions) {
      expect(region.get("LAYER")).toBe("MULTILAYER")
      expect(region.get("REGIONKIND")).toBe("BOARDCUTOUT")
      expect(region.getBoolean("KEEPOUT")).toBe(false)
      expect(region.getBoolean("LOCKED")).toBe(false)
    }
    expectValidPcb(altiumPcb)

    const circuitJsonSvg = await convertCircuitJsonToPcbSvg(
      circuitJson as Parameters<typeof convertCircuitJsonToPcbSvg>[0],
      { showCourtyards: true },
    )
    const altiumSvg = serializeAltiumPcbToSvg(altiumPcb)

    await expect(
      createSideBySideSvg(circuitJsonSvg, altiumSvg),
    ).toMatchSvgSnapshot(import.meta.path, "pcb-cutouts")
  })

  test("generates path cutout region with thickness matching specified slot_width", () => {
    const slotWidthMm = 1.2
    const circuitJson: CircuitElement[] = [
      board({ width: 20, height: 20 }),
      {
        type: "pcb_cutout",
        pcb_cutout_id: "straight_slot",
        shape: "path",
        route: [
          { x: -5, y: 0 },
          { x: 5, y: 0 },
        ],
        slot_width: slotWidthMm,
      },
    ]

    const doc = createPcbDocument(circuitJson)
    const altiumPcb = parseAltiumPcbDoc(doc)
    const regions = altiumPcb.getRecordsByKind("Region")
    expect(regions).toHaveLength(1)

    const region = regions[0]!
    expect(region.get("LAYER")).toBe("MULTILAYER")
    expect(region.get("REGIONKIND")).toBe("BOARDCUTOUT")

    // Extract all VY coordinates from the region record
    const vyValues: number[] = []
    for (let i = 0; ; i++) {
      const vyStr = region.get(`VY${i}`)
      if (!vyStr) break
      const milVal = parseFloat(vyStr.replace("mil", ""))
      vyValues.push((milVal * 25.4) / 1000)
    }
    expect(vyValues.length).toBeGreaterThanOrEqual(4)

    const minY = Math.min(...vyValues)
    const maxY = Math.max(...vyValues)
    const heightMm = maxY - minY
    expect(heightMm).toBeCloseTo(slotWidthMm, 1)
  })

  test("uses robust path offsetting for routes with repeated points", () => {
    const doc = createPcbDocument([
      board({ width: 20, height: 20 }),
      {
        type: "pcb_cutout",
        pcb_cutout_id: "repeated_point_slot",
        shape: "path",
        route: [
          { x: -4, y: 0 },
          { x: -4, y: 0 },
          { x: 0, y: 0 },
          { x: 2, y: 3 },
        ],
        slot_width: 0.6,
      },
    ])

    const [region] = parseAltiumPcbDoc(doc).getRecordsByKind("Region")
    expect(region).toBeDefined()
    expect(doc).not.toMatch(/V[XY]\d+=(?:NaN|Infinity|-Infinity)/)
  })

  test("rejects unsupported dashed path semantics instead of approximating them", () => {
    const dashedCutout: CircuitElement = {
      type: "pcb_cutout",
      pcb_cutout_id: "dashed_slot",
      shape: "path",
      route: [
        { x: -5, y: 0 },
        { x: 5, y: 0 },
      ],
      slot_width: 1,
      slot_length: 2,
      space_between_slots: 1,
    }

    expect(() => createPcbDocument([board(), dashedCutout])).toThrow(
      "Dashed path cutouts are not supported",
    )
  })

  test("throws when encountering an unsupported cutout shape", () => {
    const invalidCutout = {
      type: "pcb_cutout",
      pcb_cutout_id: "invalid_cutout",
      shape: "ellipse" as unknown as "rect",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
    } as unknown as CircuitElement

    expect(() => createPcbDocument([board(), invalidCutout])).toThrow(
      "Unsupported PCB cutout shape: ellipse",
    )
  })
})
