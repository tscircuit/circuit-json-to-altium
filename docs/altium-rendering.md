# Altium format previews

The schematic snapshots use a pinned `altiumts` renderer so native-format mistakes in the current exporter remain visible. This change deliberately leaves the exporter output as it is. A passing visual regression means the output matches the recorded baseline; it does **not** mean the conversion is correct.

The merged renderer commit `6c8af3de0e50c7d918f7f2bf43cca5af604cf9cc` is pinned in `package.json` and installed by `bun install`. It includes the native renderer merged in [altiumts PR #153](https://github.com/tscircuit/altiumts/pull/153), so all callers of `serializeAltiumSheetToSvg` use the same interpretation. It does not modify the parser's preserved fields or the binary serializer. This repository records the resulting converter baselines.

## Behavior exposed by the new baselines

| Exported data | Previous local preview | Updated local preview |
| --- | --- | --- |
| `X2=258.08` | Accepts decimal coordinates | Invalid integer base field falls back to zero; stretched polygons expose the error |
| `X2=258` and `X2_FRAC=8000` | Treats the fraction like decimal digits (`0.8`) | Adds the signed fraction divided by 100,000 (`0.08`) |
| `SIZE5=3.6000` | Uses font size 3.6 | Invalid integer size uses fallback 10; oversized labels expose the error |
| `FONTID=2` on a pin | Uses font 2 for both name and number | Resolves `SYSTEMFONT`, or each enabled `NAME_CUSTOMFONTID` / `DESIGNATOR_CUSTOMFONTID`; missing system font uses Times New Roman 10 |
| `ISHIDDEN=T` on a net label, plus separate graphic text | Hides the native net label | Draws both labels, exposing duplicate text |
| Pin without `ELECTRICAL` | No electrical-type indicator | Uses input type; passive/power pins need their explicit native types |

The automotive microcontroller comparison now exposes the same **classes of failure** visible in the user's Altium 365 capture: large pin/annotation text, leftward polygon stretching, duplicate net labels and extra terminal indicators. Open [its snapshot](../tests/__snapshots__/visual09-generated-system-repros-automotive-mirror-system-04-microcontroller.snap.svg). Left is Circuit JSON; right is the local Altium format preview.

## Evidence and limits

This is a local renderer, not the Altium 365 rendering engine or a captured render from Altium Designer. The independent format references establish the integer/fraction encoding and pin settings. Invalid-coordinate fallback, invalid-size fallback and net-label visibility are modeled from the supplied Altium 365 screenshot; they still need isolated fixtures rendered by Altium to establish exact behavior across versions.

- [KiCad's Altium importer](https://github.com/KiCad/kicad-source-mirror/blob/master/eeschema/sch_io/altium/altium_parser_sch.cpp) reads coordinate and font-size base/fraction fields as integers and defaults an unspecified pin electrical type to input.
- [Altium pin documentation](https://www.altium.com/documentation/altium-designer/components-libraries/creating-schematic-symbol) explains the system font and independent pin name/designator custom settings.
- [python-altium format notes](https://github.com/vadmium/python-altium/blob/master/format.md) document native pin custom-font fields, electrical types and `SYSTEMFONT`.

Default pin margins and enabled custom margins/colors are handled. Exact glyph metrics, custom pin text rotation/vertical margins, sheet clipping/border behavior, inferred junction dots and all electrical symbol types are not fully matched. The renderer implements input/output/bidirectional indicators; the other non-passive types retain the existing renderer limitation. Do not describe these snapshots as pixel-identical official Altium output, or tune exporter values just to compensate for those remaining renderer differences.

Review the SVGs in a browser when checking text. During inspection, Resvg rasterization of the comparison's nested SVG images omitted embedded text, while rendering the standalone schematic retained it. Detailed renderer tests in altiumts therefore also assert font selection, sizes and text visibility; a pixel comparison alone is insufficient evidence for text behavior.

## Reproduce and review

```sh
bun install
bun test tests/schematic21-native-rendering.test.ts
bun test tests/visual09-generated-system-repros.test.ts
```

The converter integration test exports a small Circuit JSON component to a binary SchDoc, parses that exported file, and snapshots its SVG using the installed renderer. Detailed native-coordinate, font, visibility and field-preservation cases live only in [altiumts's renderer tests](https://github.com/tscircuit/altiumts/tree/main/tests/svg), with one test per file. To intentionally update baselines after reviewing a renderer change:

```sh
BUN_UPDATE_SNAPSHOTS=1 FORCE_BUN_UPDATE_SNAPSHOTS=1 bun test tests/visual09-generated-system-repros.test.ts
```

Both flags are needed to save text-only SVG changes even if raster comparison reports equal images.

Review renderer behavior and baselines first. Fix exporter coordinates, fonts, net-label representation and pin electrical types in subsequent changes, using independent Altium renders as the reference.

Validation: the full [baseline CI test run](https://github.com/tscircuit/circuit-json-to-altium/actions/runs/34267437467) passed 98 tests across 71 files. A local schematic run passed 58 tests across 36 files. Typecheck and format check passed. Earlier artifact verification confirmed all eight automotive `.SchDoc` files and 32 generated-system Circuit JSON source panels were byte-for-byte unchanged by the rendering switch.


The updated renderer also honors native pin custom-color fields and position bit
0 (default name/designator margins -7/+9), places IEEE clock symbols inside the
body, and interprets the native line-width enum, including screen hairlines.
Font-table `SIZE` is an integer; `SIZE*_FRAC` is not supported by Altium and is
ignored. KiCad accepting that field does not establish native Altium support.
See the independent [native field reference](https://github.com/akiselev/altium-cli/blob/master/docs/reference/ad26/file-format-constants.md).
Exporter corrections remain in the stacked PRs. Final font metrics and viewer
preferences still require a fresh Altium 365 capture of the corrected export.
