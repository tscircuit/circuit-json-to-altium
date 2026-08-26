import type { CircuitJson as StandardCircuitJson } from "circuit-json"

export type CircuitElement = Record<string, unknown> & { type?: string }

export type CircuitJson = StandardCircuitJson
export type CircuitJsonInput = CircuitJson | CircuitElement[]
export type NormalizedCircuitJson = CircuitElement[]

export type AltiumPcbFile = {
  asciiContent: string
  content: Uint8Array
  filename: string
}

export type AltiumSchematicFile = {
  asciiContent: string
  content: Uint8Array
  filename: string
}

export type AltiumProjectFile = {
  content: string
  filename: string
}

export type CircuitJsonToAltiumOutput = {
  pcb: AltiumPcbFile
  project: AltiumProjectFile
  schematics: AltiumSchematicFile[]
}

export type CircuitJsonToAltiumConverterContext = {
  circuitJson: NormalizedCircuitJson
  pcb?: AltiumPcbFile
  project?: AltiumProjectFile
  projectName: string
  safeProjectName: string
  schematics?: AltiumSchematicFile[]
  validated: boolean
}

export type Point = { x: number; y: number }
export type PointWithBulge = Point & { bulge?: number }
export type PointTransform = (circuitPoint: Point) => Point
export type LengthTransform = (circuitLength: number) => number

export type PcbComponentId = string
export type PcbNetName = string
export type PcbPortId = string
export type PcbTraceId = string
export type SchematicComponentId = string
export type SchematicSymbolId = string
export type SchematicSheetId = string
export type SourceComponentId = string
export type SourceNetId = string
export type SourcePortId = string
export type SourceTraceId = string
