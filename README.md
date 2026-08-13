# circuit-json-to-altium

Convert Circuit JSON schematic and PCB content into an Altium Designer project archive.

## Installation

```bash
bun add circuit-json-to-altium
```

## Usage

```ts
import { convertCircuitJsonToAltiumZip } from "circuit-json-to-altium"

const archiveBytes = await convertCircuitJsonToAltiumZip(
  circuitJson,
  "motor-controller",
)

await Bun.write("motor-controller-altium.zip", archiveBytes)
```

The returned ZIP archive contains:

- a native binary `.PcbDoc`
- one native binary `.SchDoc` per Circuit JSON schematic sheet
- a native binary `.PrjPcb`
- a short conversion note

The converter validates its generated PCB and schematic documents before returning the archive. Invalid geometry is rejected with a descriptive error instead of producing a corrupt project.

## Supported content

The current converter handles board outlines, components, pads, plated and non-plated holes, routed copper with vias, nets, PCB silkscreen, schematic components, ports, labels, junctions, and traces. It also preserves multiple schematic sheets and sanitizes Altium field and filename text.

`altiumts` owns the Altium document model, parsing, and native binary serialization. This package owns the Circuit JSON-to-Altium mapping and archive assembly.

## Development

```bash
bun install
bun run check
```

Tests follow the tscircuit convention of one test case per test file. The suite covers archive structure, filename sanitization, PCB geometry and connectivity, schematic primitives and sheets, randomized inputs, and native binary round trips.
