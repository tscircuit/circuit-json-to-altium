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

## Native Altium component-text review file

[`automotive-mirror-microcontroller-component-text-4pt.SchDoc`](./automotive-mirror-microcontroller-component-text-4pt.SchDoc)
is the microcontroller sheet exported from
`generated-system-automotive-mirror.circuit.json` by converter commit
`1ed7cca8a9b35833c0fb90fec15fa64fccb67cba` with project name
`automotive-mirror-system` (output sheet `automotive-mirror-system-04.SchDoc`).
It lets reviewers inspect the native U1/MPN font-size fix in an Altium viewer.
U1, its MPN, C1/C2 and the capacitor value use Arial 4; existing pin and net-label
issues remain for separate fixes. Its rendered SVG matches the updated
microcontroller comparison snapshot.

- SHA-256: `88653166ea1b0d7298a15702907a8113ad84ec0d9120645307e4e2aa703deefd`
