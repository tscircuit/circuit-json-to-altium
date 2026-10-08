import { expect, test } from "bun:test"
import { createPcbTextRecord } from "../lib/create-pcb-text-record"
import { board, extractArchive } from "./fixtures"

test("preserves zero-margin bottom knockout text and rejects asymmetric padding", async () => {
  const text = {
    type: "pcb_silkscreen_text",
    pcb_silkscreen_text_id: "label",
    text: "TEST",
    layer: "bottom",
    anchor_position: { x: 1, y: 2 },
    font_size: 1,
    ccw_rotation: 90,
    is_knockout: true,
    knockout_padding: { left: 0, right: 0, top: 0, bottom: 0 },
  }
  const { pcb } = await extractArchive([board(), text])
  const exported = pcb.texts[0]!
  expect(exported.getBoolean("INVERTED")).toBe(true)
  expect(exported.get("LAYER")).toBe("BOTTOMOVERLAY")
  expect(exported.getBoolean("MIRROR")).toBe(true)
  expect(
    exported.getAltiumMeasurement("MARGINBORDERWIDTH")?.toMillimeters(),
  ).toBe(0)
  expect(() =>
    createPcbTextRecord({
      circuitText: {
        ...text,
        knockout_padding: { left: 0.1, right: 0.2, top: 0.1, bottom: 0.1 },
      },
      circuitToAltiumPcbPoint: (point) => point,
      layer: "BOTTOMOVERLAY",
    }),
  ).toThrow("equal, non-negative padding")
})
