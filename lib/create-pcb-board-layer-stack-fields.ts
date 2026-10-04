/**
 * Board6 layer-stack fields for a plain two-layer board, in the form Altium
 * Designer writes them (V9 stack, V8 master/sub stack and the legacy
 * LAYERn chain). A Board record with only the outline makes Altium report
 * "exception ... loading section Board6: Catastrophic failure" on open.
 *
 * GUIDs are fixed so exports stay byte-for-byte reproducible.
 */
const MASTER_STACK_ID = "{6A1C0B7E-0000-4C17-9E30-7C5C1A000001}"
const SUB_STACK_ID = "{6A1C0B7E-0000-4C17-9E30-7C5C1A000002}"

type StackLayer = {
  name: string
  layerId: number
  usedByPrims: boolean
  extra?: string[]
}

const SOLDER_RESIST = [
  "DIELTYPE=3",
  "DIELCONST=3.500",
  "DIELHEIGHT=0.4mil",
  "DIELMATERIAL=Solder Resist",
  "COVERLAY_EXPANSION=0mil",
]

const TWO_LAYER_STACK: StackLayer[] = [
  { name: "Top Paste", layerId: 16973832, usedByPrims: false },
  { name: "Top Overlay", layerId: 16973830, usedByPrims: true },
  {
    name: "Top Solder",
    layerId: 16973834,
    usedByPrims: false,
    extra: SOLDER_RESIST,
  },
  {
    name: "Top Layer",
    layerId: 16777217,
    usedByPrims: true,
    extra: ["COPTHICK=1.4mil", "COMPONENTPLACEMENT=1"],
  },
  {
    name: "Dielectric 1",
    layerId: 17039361,
    usedByPrims: false,
    extra: [
      "DIELTYPE=0",
      "DIELCONST=4.800",
      "DIELHEIGHT=12.6mil",
      "DIELMATERIAL=FR-4",
    ],
  },
  {
    name: "Bottom Layer",
    layerId: 16842751,
    usedByPrims: true,
    extra: ["COPTHICK=1.4mil", "COMPONENTPLACEMENT=2"],
  },
  {
    name: "Bottom Solder",
    layerId: 16973835,
    usedByPrims: false,
    extra: SOLDER_RESIST,
  },
  { name: "Bottom Overlay", layerId: 16973831, usedByPrims: true },
  { name: "Bottom Paste", layerId: 16973833, usedByPrims: false },
]

// Legacy (pre-V8) layer chain: ordinal, name, prev, next.
const LEGACY_LAYERS: Array<[number, string, number, number]> = [
  [1, "Top Layer", 0, 32],
  [32, "Bottom Layer", 1, 0],
  [33, "Top Overlay", 0, 1],
  [34, "Bottom Overlay", 32, 0],
  [35, "Top Paste", 0, 1],
  [36, "Bottom Paste", 32, 0],
  [37, "Top Solder", 0, 1],
  [38, "Bottom Solder", 32, 0],
]

const bool = (value: boolean) => (value ? "TRUE" : "FALSE")

export function createPcbBoardLayerStackFields(): string[] {
  const stackDescription = (prefix: string) => [
    `${prefix}SHOWTOPDIELECTRIC=FALSE`,
    `${prefix}SHOWBOTTOMDIELECTRIC=FALSE`,
    `${prefix}ISFLEX=FALSE`,
  ]
  const fields = [
    "V9_MASTERSTACK_STYLE=0",
    `V9_MASTERSTACK_ID=${MASTER_STACK_ID}`,
    "V9_MASTERSTACK_NAME=Master layer stack",
    ...stackDescription("V9_MASTERSTACK_"),
    `V9_SUBSTACK0_ID=${SUB_STACK_ID}`,
    "V9_SUBSTACK0_NAME=Board Layer Stack",
    ...stackDescription("V9_SUBSTACK0_"),
    "V9_SUBSTACK0_SERVICE=FALSE",
    "V9_SUBSTACK0_USEDBYPRIMS=FALSE",
    "V9_SUBSTACK0_TYPE=1",
  ]
  for (const [index, layer] of TWO_LAYER_STACK.entries()) {
    const prefix = `V9_STACK_LAYER${index}_`
    fields.push(
      `${prefix}${SUB_STACK_ID}CONTEXT=0`,
      `${prefix}${SUB_STACK_ID}USEDBYPRIMS=FALSE`,
      `${prefix}ID={6A1C0B7E-0000-4C17-9E30-7C5C1A0001${String(index).padStart(2, "0")}}`,
      `${prefix}NAME=${layer.name}`,
      `${prefix}LAYERID=${layer.layerId}`,
      `${prefix}USEDBYPRIMS=${bool(layer.usedByPrims)}`,
      ...(layer.extra ?? []).map((field) => `${prefix}${field}`),
    )
  }
  fields.push(
    "LAYERMASTERSTACK_V8STYLE=0",
    `LAYERMASTERSTACK_V8ID=${MASTER_STACK_ID}`,
    "LAYERMASTERSTACK_V8NAME=Master layer stack",
    ...stackDescription("LAYERMASTERSTACK_V8"),
    `LAYERSUBSTACK_V8_0ID=${SUB_STACK_ID}`,
    "LAYERSUBSTACK_V8_0NAME=Board Layer Stack",
    ...stackDescription("LAYERSUBSTACK_V8_0"),
    "LAYERSUBSTACK_V8_0SERVICE=FALSE",
    "LAYERSUBSTACK_V8_0USEDBYPRIMS=FALSE",
    "LAYERSUBSTACK_V8_0TYPE=1",
    "TOPTYPE=3",
    "TOPCONST=3.500",
    "TOPHEIGHT=0.4mil",
    "TOPMATERIAL=Solder Resist",
    "BOTTOMTYPE=3",
    "BOTTOMCONST=3.500",
    "BOTTOMHEIGHT=0.4mil",
    "BOTTOMMATERIAL=Solder Resist",
    "LAYERSTACKSTYLE=0",
    "SHOWTOPDIELECTRIC=FALSE",
    "SHOWBOTTOMDIELECTRIC=FALSE",
  )
  for (const [ordinal, name, prev, next] of LEGACY_LAYERS) {
    fields.push(
      `LAYER${ordinal}NAME=${name}`,
      `LAYER${ordinal}PREV=${prev}`,
      `LAYER${ordinal}NEXT=${next}`,
      `LAYER${ordinal}MECHENABLED=FALSE`,
      `LAYER${ordinal}COPTHICK=1.4mil`,
      `LAYER${ordinal}DIELTYPE=0`,
      `LAYER${ordinal}DIELCONST=4.800`,
      `LAYER${ordinal}DIELHEIGHT=12.6mil`,
      `LAYER${ordinal}DIELMATERIAL=FR-4`,
    )
  }
  fields.push(
    "LAYERPAIR0LOW=TOP",
    "LAYERPAIR0HIGH=BOTTOM",
    "LAYERPAIR0DRILLGUIDE=FALSE",
    "LAYERPAIR0DRILLDRAWING=FALSE",
    `LAYERPAIR0SUBSTACK_0=${SUB_STACK_ID}`,
  )
  return fields
}
