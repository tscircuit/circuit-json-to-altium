import { expect, test } from "bun:test"
import { getAltiumColorFromCss } from "../lib/altium-color"

const fallbackAltiumColor = 0x03_02_01

test("converts CSS colors to Altium BGR integers", () => {
  expect(
    getAltiumColorFromCss({
      cssColor: "#123456",
      fallbackAltiumColor,
    }),
  ).toBe(0x56_34_12)
  expect(
    getAltiumColorFromCss({
      cssColor: "rgba(132, 0, 0)",
      fallbackAltiumColor,
    }),
  ).toBe(0x00_00_84)
  expect(
    getAltiumColorFromCss({
      cssColor: "rgb(10% 20% 30% / 40%)",
      fallbackAltiumColor,
    }),
  ).toBe(0x4d_33_1a)
  expect(
    getAltiumColorFromCss({
      cssColor: "not-a-color",
      fallbackAltiumColor,
    }),
  ).toBe(fallbackAltiumColor)
})
