import { resolve } from "node:path"
import {
  AltiumBinaryPcbDoc,
  AltiumPcbDoc,
  type AltiumPcbDocument,
  parseAltiumFile,
  serializeAltiumPcbToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../../lib"
import { convertAltiumPcbToCircuitJson } from "./convert-altium-pcb-to-circuit-json"
import { getPcbRoundTripMetrics } from "./get-pcb-round-trip-metrics"

export type OpenSourceBoardRoundTrip = ReturnType<
  typeof getPcbRoundTripMetrics
> & {
  roundTripNativeArcCount: number
  roundTripSvg: string
  sourceNativeArcCount: number
  sourceSvg: string
}

type OpenSourceBoardRoundTripOptions = {
  boardName: string
  filename: string
}

function parsePcbDoc(pcbDocBytes: Uint8Array): AltiumPcbDocument {
  const document = parseAltiumFile(pcbDocBytes).document
  if (
    !(document instanceof AltiumPcbDoc) &&
    !(document instanceof AltiumBinaryPcbDoc)
  ) {
    throw new Error(`Expected an Altium PCB document, got ${document.type}`)
  }
  return document
}

export async function createOpenSourceBoardRoundTrip({
  boardName,
  filename,
}: OpenSourceBoardRoundTripOptions): Promise<OpenSourceBoardRoundTrip> {
  const sourcePath = resolve(
    import.meta.dir,
    "..",
    "..",
    "references",
    filename,
  )
  const sourceBytes = new Uint8Array(await Bun.file(sourcePath).arrayBuffer())
  const sourceDocument = parsePcbDoc(sourceBytes)
  const sourceCircuitJson = convertAltiumPcbToCircuitJson(sourceDocument)
  const converter = new CircuitJsonToAltiumConverter(sourceCircuitJson, {
    projectName: boardName,
  })
  converter.runUntilFinished()
  const generatedPcb = converter.getOutput().pcb
  const generatedBytes = Uint8Array.from(generatedPcb.content)
  const roundTripDocument = parsePcbDoc(generatedBytes)
  const roundTripCircuitJson = convertAltiumPcbToCircuitJson(roundTripDocument)
  const metrics = getPcbRoundTripMetrics({
    roundTripCircuitJson,
    sourceCircuitJson,
  })

  return {
    ...metrics,
    roundTripNativeArcCount: getRepresentedNativeArcCount(roundTripDocument),
    roundTripSvg: serializeAltiumPcbToSvg(roundTripDocument),
    sourceNativeArcCount: getRepresentedNativeArcCount(sourceDocument),
    sourceSvg: serializeAltiumPcbToSvg(sourceDocument),
  }
}

function getRepresentedNativeArcCount(document: AltiumPcbDocument): number {
  return document.getRecordsByKind("Arc").filter((arc) => {
    const normalizedLayer = normalizeLayer(arc.getDecoded("LAYER"))
    if (normalizedLayer === "KEEPOUT") return isFullCircleArc(arc)
    return isRepresentedArcLayer(normalizedLayer)
  }).length
}

function isRepresentedArcLayer(normalizedLayer: string): boolean {
  return (
    normalizedLayer === "TOP" ||
    normalizedLayer === "BOTTOM" ||
    normalizedLayer.startsWith("MIDLAYER") ||
    normalizedLayer.startsWith("INTERNALPLANE") ||
    normalizedLayer === "TOPOVERLAY" ||
    normalizedLayer === "BOTTOMOVERLAY" ||
    normalizedLayer === "MECHANICAL1" ||
    normalizedLayer === "MECHANICAL2" ||
    normalizedLayer === "MECHANICAL15" ||
    normalizedLayer === "MECHANICAL16"
  )
}

function isFullCircleArc(
  arc: ReturnType<AltiumPcbDocument["getRecordsByKind"]>[number],
): boolean {
  const startAngleDegrees = arc.getNumber("STARTANGLE") ?? 0
  const endAngleDegrees = arc.getNumber("ENDANGLE") ?? 360
  const sweepDegrees = endAngleDegrees - startAngleDegrees
  return Math.abs(sweepDegrees) >= 360 - 1e-9 || sweepDegrees === 0
}

function normalizeLayer(layer: string | undefined): string {
  return layer?.replace(/[\s_-]+/gu, "").toUpperCase() ?? ""
}
