import { resolve } from "node:path"
import {
  AltiumBinaryPcbDoc,
  AltiumPcbDoc,
  type AltiumPcbDocument,
  parseAltiumFile,
  serializeAltiumPcbToSvg,
} from "altiumts"
import {
  type CircuitJson,
  pcb_hole,
  pcb_plated_hole,
  pcb_smtpad,
} from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../../lib"
import type { CircuitElement } from "../../lib/types"
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

function createRenderableSourceCircuitJson(
  circuitJson: CircuitElement[],
): CircuitJson {
  return circuitJson.filter((element) => {
    if (element.type === "pcb_smtpad") {
      return pcb_smtpad.safeParse(element).success
    }
    if (element.type === "pcb_plated_hole") {
      return pcb_plated_hole.safeParse(element).success
    }
    if (element.type === "pcb_hole") {
      return pcb_hole.safeParse(element).success
    }
    return true
  }) as CircuitJson
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
    roundTripSvg: serializeAltiumPcbToSvg(roundTripDocument),
    sourceSvg: convertCircuitJsonToPcbSvg(
      createRenderableSourceCircuitJson(sourceCircuitJson),
      { showCourtyards: true },
    ),
  }
}
