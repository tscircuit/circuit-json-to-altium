import {
  asPositiveNumber,
  asString,
  byType,
  formatMil,
  isCircuitElement,
  MILLIMETERS_TO_MILS,
} from "./format"
import type { CircuitElement } from "./types"

const DEFAULT_BOARD_THICKNESS_MM = 1.6
const DEFAULT_COPPER_THICKNESS_MM = 0.035
const DEFAULT_DIELECTRIC_CONSTANT = "4.800"
const DEFAULT_DIELECTRIC_MATERIAL = "FR-4"
const MAX_COPPER_LAYERS = 32
const MASTER_STACK_ID = "{11111111-1111-4111-8111-111111111101}"
const SUBSTACK_ID = "{22222222-2222-4222-8222-222222222201}"

type LegacyLayerEntry = {
  id: number
  name: string
}

type V8LayerEntry = {
  componentPlacement?: number
  copperThicknessMils?: string
  dielectricConstant?: string
  dielectricHeightMils?: string
  dielectricMaterial?: string
  dielectricType?: number
  layerId: number
  mechanicalEnabled?: boolean
  name: string
  usedByPrimitives: boolean
}

const STANDARD_LEGACY_LAYERS: LegacyLayerEntry[] = [
  { id: 1, name: "Top Layer" },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: index + 2,
    name: `Mid-Layer ${index + 1}`,
  })),
  { id: 32, name: "Bottom Layer" },
  { id: 33, name: "Top Overlay" },
  { id: 34, name: "Bottom Overlay" },
  { id: 35, name: "Top Paste" },
  { id: 36, name: "Bottom Paste" },
  { id: 37, name: "Top Solder" },
  { id: 38, name: "Bottom Solder" },
  ...Array.from({ length: 16 }, (_, index) => ({
    id: 39 + index,
    name: `Internal Plane ${index + 1}`,
  })),
  { id: 55, name: "Drill Guide" },
  { id: 56, name: "Keep-Out Layer" },
  ...Array.from({ length: 16 }, (_, index) => ({
    id: 57 + index,
    name: `Mechanical ${index + 1}`,
  })),
  { id: 73, name: "Drill Drawing" },
  { id: 74, name: "Multi-Layer" },
  { id: 75, name: "Connections" },
  { id: 76, name: "Background" },
  { id: 77, name: "DRC Error Markers" },
  { id: 78, name: "Selections" },
  { id: 79, name: "Visible Grid 1" },
  { id: 80, name: "Visible Grid 2" },
  { id: 81, name: "Pad Holes" },
  { id: 82, name: "Via Holes" },
]

function parseInnerLayerOrdinal(layer: unknown): number | undefined {
  const match = /^inner([1-8])$/iu.exec(asString(layer))
  return match?.[1] ? Number(match[1]) : undefined
}

function getMaxUsedInnerLayerOrdinal(circuitJson: CircuitElement[]): number {
  let maxInnerLayer = 0
  for (const element of circuitJson) {
    const directLayer = parseInnerLayerOrdinal(element.layer)
    if (directLayer && directLayer > maxInnerLayer) {
      maxInnerLayer = directLayer
    }
    if (Array.isArray(element.layers)) {
      for (const layer of element.layers) {
        const parsed = parseInnerLayerOrdinal(layer)
        if (parsed && parsed > maxInnerLayer) {
          maxInnerLayer = parsed
        }
      }
    }
    if (element.type === "pcb_trace" && Array.isArray(element.route)) {
      for (const point of element.route) {
        if (!isCircuitElement(point)) continue
        const parsed = parseInnerLayerOrdinal(point.layer)
        if (parsed && parsed > maxInnerLayer) {
          maxInnerLayer = parsed
        }
      }
    }
  }
  return maxInnerLayer
}

function getEffectiveCopperLayerCount(
  board: CircuitElement | undefined,
  circuitJson: CircuitElement[],
): number {
  const declaredLayers =
    typeof board?.num_layers === "number" &&
    Number.isFinite(board.num_layers) &&
    board.num_layers > 0
      ? Math.trunc(board.num_layers)
      : undefined
  if (declaredLayers !== undefined) {
    return Math.min(MAX_COPPER_LAYERS, Math.max(1, declaredLayers))
  }
  const maxInnerLayer = getMaxUsedInnerLayerOrdinal(circuitJson)
  return Math.min(
    MAX_COPPER_LAYERS,
    Math.max(2, maxInnerLayer > 0 ? maxInnerLayer + 2 : 2),
  )
}

function formatLayerGuid(index: number): string {
  return `{33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}}`
}

export function createPcbBoardLayerStackFields(
  circuitJson: CircuitElement[],
): string[] {
  const board = byType(circuitJson, "pcb_board")[0]
  const copperLayerCount = getEffectiveCopperLayerCount(board, circuitJson)
  const boardThicknessMm = asPositiveNumber(
    board?.thickness,
    DEFAULT_BOARD_THICKNESS_MM,
  )

  const copperThicknessMm =
    copperLayerCount * DEFAULT_COPPER_THICKNESS_MM < boardThicknessMm
      ? DEFAULT_COPPER_THICKNESS_MM
      : (boardThicknessMm * 0.5) / copperLayerCount
  const dielectricCount = copperLayerCount >= 2 ? copperLayerCount - 1 : 1
  const dielectricThicknessMm = Math.max(
    0,
    (boardThicknessMm - copperLayerCount * copperThicknessMm) / dielectricCount,
  )

  const copperThicknessMils = formatMil(copperThicknessMm * MILLIMETERS_TO_MILS)
  const dielectricHeightMils = formatMil(
    dielectricThicknessMm * MILLIMETERS_TO_MILS,
  )

  const activeCopperLegacyIds =
    copperLayerCount === 1
      ? [1]
      : [
          1,
          ...Array.from({ length: copperLayerCount - 2 }, (_, i) => i + 2),
          32,
        ]
  const activeCopperPositionById = new Map<number, number>(
    activeCopperLegacyIds.map((id, position) => [id, position]),
  )

  const legacyFields: string[] = []
  for (const layer of STANDARD_LEGACY_LAYERS) {
    legacyFields.push(`LAYER${layer.id}NAME=${layer.name}`)
    const position = activeCopperPositionById.get(layer.id)
    if (position === undefined) continue

    const previousId = position > 0 ? activeCopperLegacyIds[position - 1]! : 0
    const nextId =
      position + 1 < activeCopperLegacyIds.length
        ? activeCopperLegacyIds[position + 1]!
        : 0
    legacyFields.push(
      `LAYER${layer.id}PREV=${previousId}`,
      `LAYER${layer.id}NEXT=${nextId}`,
      `LAYER${layer.id}MECHENABLED=FALSE`,
      `LAYER${layer.id}COPTHICK=${copperThicknessMils}`,
    )
    if (nextId !== 0 || activeCopperLegacyIds.length === 1) {
      legacyFields.push(
        `LAYER${layer.id}DIELTYPE=${position === 0 ? 0 : 1}`,
        `LAYER${layer.id}DIELCONST=${DEFAULT_DIELECTRIC_CONSTANT}`,
        `LAYER${layer.id}DIELHEIGHT=${dielectricHeightMils}`,
        `LAYER${layer.id}DIELMATERIAL=${DEFAULT_DIELECTRIC_MATERIAL}`,
      )
    }
  }

  const stackEntries: V8LayerEntry[] = [
    { name: "Top Paste", layerId: 16973832, usedByPrimitives: true },
    { name: "Top Overlay", layerId: 16973830, usedByPrimitives: true },
    { name: "Top Solder", layerId: 16973834, usedByPrimitives: true },
    {
      name: "Top Layer",
      layerId: 16777217,
      usedByPrimitives: true,
      copperThicknessMils,
      componentPlacement: 1,
    },
  ]

  if (copperLayerCount === 1) {
    stackEntries.push({
      name: "Dielectric 1",
      layerId: 17039361,
      usedByPrimitives: false,
      dielectricType: 0,
      dielectricConstant: DEFAULT_DIELECTRIC_CONSTANT,
      dielectricHeightMils,
      dielectricMaterial: DEFAULT_DIELECTRIC_MATERIAL,
    })
  } else {
    for (let midIndex = 1; midIndex <= copperLayerCount - 2; midIndex++) {
      stackEntries.push(
        {
          name: `Dielectric ${midIndex}`,
          layerId: 17039360 + midIndex,
          usedByPrimitives: false,
          dielectricType: midIndex === 1 ? 0 : 1,
          dielectricConstant: DEFAULT_DIELECTRIC_CONSTANT,
          dielectricHeightMils,
          dielectricMaterial: DEFAULT_DIELECTRIC_MATERIAL,
        },
        {
          name: `Mid-Layer ${midIndex}`,
          layerId: 16777217 + midIndex,
          usedByPrimitives: true,
          copperThicknessMils,
          componentPlacement: 0,
        },
      )
    }
    stackEntries.push(
      {
        name: `Dielectric ${copperLayerCount - 1}`,
        layerId: 17039360 + copperLayerCount - 1,
        usedByPrimitives: false,
        dielectricType: 0,
        dielectricConstant: DEFAULT_DIELECTRIC_CONSTANT,
        dielectricHeightMils,
        dielectricMaterial: DEFAULT_DIELECTRIC_MATERIAL,
      },
      {
        name: "Bottom Layer",
        layerId: 16842751,
        usedByPrimitives: true,
        copperThicknessMils,
        componentPlacement: 2,
      },
    )
  }

  stackEntries.push(
    { name: "Bottom Solder", layerId: 16973835, usedByPrimitives: true },
    { name: "Bottom Overlay", layerId: 16973831, usedByPrimitives: true },
    { name: "Bottom Paste", layerId: 16973833, usedByPrimitives: true },
    { name: "Drill Guide", layerId: 16973836, usedByPrimitives: true },
    { name: "Keep-Out Layer", layerId: 16973837, usedByPrimitives: true },
    { name: "Drill Drawing", layerId: 16973838, usedByPrimitives: true },
    { name: "Multi-Layer", layerId: 16973839, usedByPrimitives: true },
    ...Array.from({ length: 16 }, (_, index) => ({
      name: `Mechanical ${index + 1}`,
      layerId: 16908289 + index,
      usedByPrimitives: false,
      mechanicalEnabled: false,
    })),
  )

  const v8Fields: string[] = [
    "LAYERMASTERSTACK_V8STYLE=0",
    `LAYERMASTERSTACK_V8ID=${MASTER_STACK_ID}`,
    "LAYERMASTERSTACK_V8NAME=Master layer stack",
    "LAYERMASTERSTACK_V8SHOWTOPDIELECTRIC=FALSE",
    "LAYERMASTERSTACK_V8SHOWBOTTOMDIELECTRIC=FALSE",
    "LAYERMASTERSTACK_V8ISFLEX=FALSE",
    `LAYERSUBSTACK_V8_0ID=${SUBSTACK_ID}`,
    "LAYERSUBSTACK_V8_0NAME=Board Layer Stack",
    "LAYERSUBSTACK_V8_0SHOWTOPDIELECTRIC=FALSE",
    "LAYERSUBSTACK_V8_0SHOWBOTTOMDIELECTRIC=FALSE",
    "LAYERSUBSTACK_V8_0ISFLEX=FALSE",
    "LAYERSUBSTACK_V8_0SERVICE=FALSE",
    "LAYERSUBSTACK_V8_0USEDBYPRIMS=FALSE",
    "LAYERSUBSTACK_V8_0TYPE=1",
  ]

  for (const [index, entry] of stackEntries.entries()) {
    const prefix = `LAYER_V8_${index}`
    v8Fields.push(
      `${prefix}_${SUBSTACK_ID}CONTEXT=0`,
      `${prefix}_${SUBSTACK_ID}USEDBYPRIMS=FALSE`,
      `${prefix}ID=${formatLayerGuid(index)}`,
      `${prefix}NAME=${entry.name}`,
      `${prefix}LAYERID=${entry.layerId}`,
      `${prefix}USEDBYPRIMS=${entry.usedByPrimitives ? "TRUE" : "FALSE"}`,
    )
    if (entry.mechanicalEnabled !== undefined) {
      v8Fields.push(
        `${prefix}MECHENABLED=${entry.mechanicalEnabled ? "TRUE" : "FALSE"}`,
      )
    }
    if (entry.copperThicknessMils !== undefined) {
      v8Fields.push(`${prefix}COPTHICK=${entry.copperThicknessMils}`)
    }
    if (entry.componentPlacement !== undefined) {
      v8Fields.push(`${prefix}COMPONENTPLACEMENT=${entry.componentPlacement}`)
    }
    if (entry.dielectricType !== undefined) {
      v8Fields.push(`${prefix}DIELTYPE=${entry.dielectricType}`)
    }
    if (entry.dielectricConstant !== undefined) {
      v8Fields.push(`${prefix}DIELCONST=${entry.dielectricConstant}`)
    }
    if (entry.dielectricHeightMils !== undefined) {
      v8Fields.push(`${prefix}DIELHEIGHT=${entry.dielectricHeightMils}`)
    }
    if (entry.dielectricMaterial !== undefined) {
      v8Fields.push(`${prefix}DIELMATERIAL=${entry.dielectricMaterial}`)
    }
  }

  return ["DISPLAYUNIT=1", ...legacyFields, ...v8Fields]
}
