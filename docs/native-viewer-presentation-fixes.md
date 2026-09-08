# Native viewer presentation fixes

The supplied Altium 365 capture exposed differences that a local SVG preview
had hidden: pin text used native default margins and black custom-font colors,
small annotations relied on unsupported font fractions, and Circuit JSON input
arrows were exported as IEEE clock symbols inside component bodies.

The final stack exports the following native records and fields:

| Content | Native representation |
| --- | --- |
| Pin names/numbers | Independent custom-font/color and position flags, margins -2/+2, explicit source pin color |
| Annotation fonts | Positive integer `SIZE`, rounded up from `font_size × 20`; no unsupported `SIZE*_FRAC` |
| Input arrows | Owned native polygon at the outside body edge; native pin identity and terminal geometry retained |
| Wires and built-in symbol outlines | Native smallest line-width enum; explicit annotation widths mapped to the 0/1/3/5-unit enum table |
| Ordinary net labels | One visible native net label at its electrical anchor, retaining the previously approved text-only representation |
| Generated power captions | Native power port retains its net name with `SHOWNETNAME=F`, plus one black native text caption |
| Imported hidden power captions | `altium_show_net_name=false` preserves native caption visibility through the import fixture and export |
| Missing pin electrical metadata | Explicit passive fallback, avoiding Altium's implicit Input marker |

Pin electrical types remain limited by source metadata. The automotive fixture
marks CAN_TX, CAN_RX and several GPIOs with power attributes; these attributes
are translated literally and are not verified device pin classifications.

The independent [native field reference](https://github.com/akiselev/altium-cli/blob/master/docs/reference/ad26/file-format-constants.md)
documents the packed pin settings and integer font table. Its
[line-width tables](https://github.com/akiselev/altium-cli/blob/master/crates/altium-format/src/render/canvas.rs)
distinguish hairlines, wires, buses and junctions. Round-trip fixtures now decode
the line-width enum instead of treating its index as a physical width.

The new `.SchDoc` needs a fresh Altium 365 capture for final visual validation.
The accompanying SVG and PNG are local previews. Exact glyph metrics, fixed
native pin strokes, automatic junctions and viewer preferences can still differ
from Circuit JSON; passing snapshots do not establish official viewer parity.
