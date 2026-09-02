# Real Altium Viewer reference images

These manually captured PNGs supplement the automated `altiumts` SVG snapshots.
They are the visual reference for behavior that depends on Altium's rendering
engine, such as schematic font-table and native pin-font compatibility.

Each case consists of:

- `<case>.png`: a tightly framed, full-resolution Altium Viewer capture
- `<case>.md`: capture and reproduction metadata

The metadata must record:

- source repository, commit, Circuit JSON path, and SHA-256
- converter commit and generated ZIP SHA-256 (the ZIP itself is not committed)
- Altium product/version and capture date
- sheet name, zoom or fit mode, theme, and viewport size
- the expected visual behavior demonstrated by the image

Real-viewer images are review references rather than pixel-diff test inputs,
because browser, operating-system, and font rasterization differences make a
manual Altium capture unsuitable for stable CI. Automated tests remain
responsible for asserting whole-point `SIZE*` fields and the pin
`NAME_CUSTOMFONTID` and `DESIGNATOR_CUSTOMFONTID` fields. The `altiumts` SVG
snapshots provide the deterministic visual regression layer.
