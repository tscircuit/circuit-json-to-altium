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
  roundTripSvg: string
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
  const sourceCircuitJson = await convertAltiumPcbToCircuitJson(sourceDocument)
  const converter = new CircuitJsonToAltiumConverter(sourceCircuitJson, {
    projectName: boardName,
  })
  converter.runUntilFinished()
  const generatedPcb = converter.getOutput().pcb
  const generatedBytes = Uint8Array.from(generatedPcb.content)
  const roundTripDocument = parsePcbDoc(generatedBytes)
  const roundTripCircuitJson =
    await convertAltiumPcbToCircuitJson(roundTripDocument)
  const metrics = getPcbRoundTripMetrics({
    roundTripCircuitJson,
    sourceCircuitJson,
  })

  return {
    ...metrics,
    roundTripSvg: serializeAltiumPcbToSvg(roundTripDocument),
    sourceSvg: serializeAltiumPcbToSvg(sourceDocument),
  }
}
