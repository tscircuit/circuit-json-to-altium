# Real-circuit fixtures

`sparkfun-level-shifter-8-channel-txs0108e.circuit.json` is the complete Circuit
JSON export of the existing SparkFun TXS0108E 8-channel level-shifter board. The
real board already includes a four-row voltage-range table above the boxed
TXS0108E component, alongside its headers, bypass capacitors, wiring, PCB, and
source data. The fixture is not reduced to the table and does not add synthetic
content.

- Source: `tscircuit/sparkfun-boards/boards/SparkFun-Level-Shifter-8-Channel-TXS0108E/SparkFun-Level-Shifter-8-Channel-TXS0108E.circuit.tsx`
- Revision: `a92e35d0e381f85aa7964a36aef2359b507f5da5`
- License: MIT
- Generator: `tsci export --format circuit-json --disable-parts-engine`
- SHA-256: `d9ab75fafe38672dcd77a0a8e8ea9acadac210b72b25ea716df99fa8ff48225d`

## Component text sizes

[`automotive-mirror-microcontroller-component-text-4pt.SchDoc`](./automotive-mirror-microcontroller-component-text-4pt.SchDoc)
uses Arial **4 pt** for U1, its MPN, C1/C2 and their values.

Component text size depends on Circuit JSON's `schematic_text.font_size`:
multiply by **20** and round up to an integer (minimum 1 pt). U1/MPN use
`0.18 × 20 = 3.6 → 4 pt`, matching the default 4 pt used by C1/C2 and their values.

## Inline trace text sizes

[`automotive-mirror-microcontroller-inline-text-3pt.SchDoc`](./automotive-mirror-microcontroller-inline-text-3pt.SchDoc)
uses Arial **3 pt** for SWDIO, SWCLK, NRST and PA0 inline trace labels.

Inline labels are `schematic_text` with a `source_trace_id`. Their size depends
on `font_size × 20`, rounded up to an integer (minimum 1 pt):
`0.12 × 20 = 2.4 → 3 pt`. U1/MPN and capacitor text remain at 4 pt.

## Ordinary net-label text sizes

[`automotive-mirror-microcontroller-net-label-text-4pt.SchDoc`](./automotive-mirror-microcontroller-net-label-text-4pt.SchDoc)
uses Arial **4 pt** for ordinary net labels such as U6_TXD, U1_VCORE and GND.

Size depends on the matching `schematic_text.font_size`, or the default
**0.18 circuit units**, multiplied by **20** and rounded up (minimum 1 pt):
`0.18 × 20 = 3.6 → 4 pt`. Inline trace labels remain at 3 pt.

## Pointed net-label boxes

[Microcontroller](./automotive-mirror-microcontroller-pointed-net-labels.SchDoc)
and [VIN_DC_DC / EN_3P3 detail](./pointed-net-label-detail.SchDoc) use one native
4 pt label inside each pointed box, connected to the original wire anchor.
Box width fits the text; default height is `0.2 × 20 = 4` schematic units.
Coordinates use integer fields plus `_FRAC / 100000` for sub-grid positions.

## Pin name and number fonts

[Microcontroller](./automotive-mirror-microcontroller-pin-names-3pt-numbers-4pt.SchDoc)
uses Arial **3 pt** for native pin names, matching Circuit JSON's default
(`0.15 × 20 = 3 pt`). Pin numbers use **4 pt** (`0.2 × 20 = 4 pt`). An explicit
`schematic_port.display_pin_label_font_size` changes only the name font, using
`font_size × 20` rounded up (minimum 1 pt).

Altium pins use independently enabled `NAME_CUSTOMFONTID` and
`DESIGNATOR_CUSTOMFONTID` settings. Generic pin `FONTID` does not control them.
The custom settings preserve the existing pin text color.

Pin names sit **0.1 circuit units inside the body edge**, matching Circuit JSON:
`NAME_CUSTOMPOSITION_MARGIN = -(0.1 × 20) = -2`. Custom position and font are
enabled together (`PINNAME_POSITIONCONGLOMERATE=17`); numbers retain their native
position.

## Schematic stroke widths

[Microcontroller](./automotive-mirror-microcontroller-hairline-strokes.SchDoc)
uses Altium's **Smallest** preset (`LINEWIDTH=0`) for wires, component outlines
and symbol graphics, matching the existing pointed net-label outlines. This is
a native width enum, not a font size or circuit-coordinate scale factor.
Pin symbol markers also request Smallest (`SYMBOL_LINEWIDTH=0`).

Names, values, MPNs, pin names and pin numbers retain their fonts, colors and
positions. Native power-port graphics and straight pin stems retain their
native thickness; custom power-port definitions are not implemented here.
Inspect the SVG in a browser or the SchDoc in Altium: PNG snapshot rendering
does not preserve the SVG's non-scaling hairlines.

## Pin and power-symbol strokes

[Microcontroller](./automotive-mirror-microcontroller-pin-power-hairlines.SchDoc)
uses native wires with `LINEWIDTH=0` for pin stems across all component types.
The component-type regression reads every `ftype` from the Circuit JSON schema.
Electrical type depends only on each pin's `has_input_arrow` / `has_output_arrow`:
Input **0**, Output **2**, both Bidirectional **1**, neither Passive **4**.
No component `ftype` receives special handling.
Pins retain their body position, text and clock/inversion
symbols; a wire joins each shortened terminal to its original connection.
An inversion bubble retains five schematic units of native pin length.

VDD/GND remain native power ports. Their graphics depend on custom
`ObjectDefinitions` with `LineWidth=0` (Altium's Smallest preset).
Names, values and pin numbers remain Arial **4 pt**; pin names remain **3 pt**.
The pin-stem and power-symbol rendering was checked in the real Altium 365 Viewer.

## Custom symbol strokes

[Light motor control power supply](./light-motor-control-power-supply-custom-symbol-hairlines.SchDoc)
uses **Smallest** (`LINEWIDTH=0`) for custom lines, paths, polygons, circles,
arcs and rectangles, matching built-in symbols. `LINEWIDTH` is an Altium width
preset; Circuit JSON's `stroke_width` is not converted as a coordinate length.
Text fonts, geometry, fills and dashed styles are unchanged.

## Standalone and custom-symbol text sizes

[Light motor control power supply](./light-motor-control-power-supply-annotation-text-5pt.SchDoc)
uses Arial **5 pt** for the Open/Close notes and voltage annotations.
Size depends on `schematic_text.font_size × 20`, rounded up to an integer
(minimum 1 pt): `0.22 × 20 = 4.4 → 5 pt`. Native integer font sizes prevent
Altium Viewer from falling back to oversized text. Anchors, positions and
colors are preserved.

[Blood pressure input/reference sheet](./blood-pressure-input-reference-custom-text.SchDoc)
uses Arial **4 pt** for custom-symbol U3 (`0.18 × 20 = 3.6 → 4 pt`),
**3 pt** for its MPN (`0.14 × 20 = 2.8 → 3 pt`) and **3 pt** for its drawn
pin numbers (`0.13 × 20 = 2.6 → 3 pt`). Text linked by `schematic_symbol_id`
uses the same native font-size mapping as standalone notes.

## Junction dots

[Light motor control power supply](./light-motor-control-power-supply-smallest-junctions.SchDoc)
explicitly selects Altium's **Smallest** junction preset (`RECORD=29`, `SIZE=0`).
Junctions remain native electrical objects at their original connection points.
The installed local renderer draws this preset with radius **1.5** instead of
the omitted-size fallback of **1.8** schematic units. Circuit JSON's radius is
**0.03 circuit units** (**0.6** after conversion), so this is not an exact radius
match; the native preset and the local renderer's size approximation are distinct.
