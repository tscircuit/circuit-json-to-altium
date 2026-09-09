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
