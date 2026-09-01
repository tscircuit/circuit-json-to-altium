import { resolve } from "node:path"
import {
  AltiumPrjPcb,
  AltiumSchDoc,
  parseAltiumFile,
  serializeAltiumSheetToSvg,
} from "altiumts"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../../lib"
import { convertAltiumSchematicToCircuitJson } from "./convert-altium-schematic-to-circuit-json"
import { getSchematicRoundTripMetrics } from "./get-schematic-round-trip-metrics"

export type OpenSourceSchematicRoundTrip = ReturnType<
  typeof getSchematicRoundTripMetrics
> & {
  roundTripOffSheetPortFontSizePoints: number[]
  roundTripSvg: string
  sourceOffSheetPortFontSizePoints: number[]
  sourceSvg: string
}

type OpenSourceSchematicRoundTripOptions = {
  filename: string
  projectName: string
  sourceProject?: {
    documentName: string
    filename: string
    projectName: string
  }
}

const ALTIUM_SCHEMATIC_PORT_FALLBACK_FONT_SIZE_POINTS = 8

function getOffSheetPortFontSizePoints(document: AltiumSchDoc): number[] {
  const sheetRecord = document.getRecordsByKind("31")[0]
  return document.ports.map((port) => {
    const fontId = Math.max(Math.round(port.getNumber("FONTID") ?? 1), 1)
    return (
      sheetRecord?.getNumber(`SIZE${fontId}`) ??
      ALTIUM_SCHEMATIC_PORT_FALLBACK_FONT_SIZE_POINTS
    )
  })
}

function parseSchematicDocument(schematicBytes: Uint8Array): AltiumSchDoc {
  const document = parseAltiumFile(schematicBytes).document
  if (!(document instanceof AltiumSchDoc)) {
    throw new Error(
      `Expected an Altium schematic document, got ${document.type}`,
    )
  }
  return document
}

function parseProjectDocument(projectBytes: Uint8Array): AltiumPrjPcb {
  const document = parseAltiumFile(projectBytes).document
  if (!(document instanceof AltiumPrjPcb)) {
    throw new Error(`Expected an Altium project document, got ${document.type}`)
  }
  return document
}

async function readReference(filename: string): Promise<Uint8Array> {
  const referencePath = resolve(
    import.meta.dir,
    "..",
    "..",
    "references",
    filename,
  )
  return new Uint8Array(await Bun.file(referencePath).arrayBuffer())
}

export async function createOpenSourceSchematicRoundTrip({
  filename,
  projectName,
  sourceProject,
}: OpenSourceSchematicRoundTripOptions): Promise<OpenSourceSchematicRoundTrip> {
  const sourceBytes = await readReference(filename)
  const sourceDocument = parseSchematicDocument(sourceBytes)
  const sourceProjectContext = sourceProject
    ? {
        documentName: sourceProject.documentName,
        project: parseProjectDocument(
          await readReference(sourceProject.filename),
        ),
        projectName: sourceProject.projectName,
      }
    : undefined
  const sourceCircuitJson = convertAltiumSchematicToCircuitJson(
    sourceDocument,
    sourceProjectContext,
  )
  const converter = new CircuitJsonToAltiumConverter(sourceCircuitJson, {
    projectName,
  })
  converter.runUntilFinished()
  const generatedSchematic = converter.getOutput().schematics[0]
  if (!generatedSchematic) {
    throw new Error("Converter did not create a schematic document")
  }
  const roundTripDocument = parseSchematicDocument(generatedSchematic.content)
  const roundTripCircuitJson =
    convertAltiumSchematicToCircuitJson(roundTripDocument)

  return {
    ...getSchematicRoundTripMetrics({
      roundTripCircuitJson,
      sourceCircuitJson,
    }),
    roundTripOffSheetPortFontSizePoints:
      getOffSheetPortFontSizePoints(roundTripDocument),
    roundTripSvg: serializeAltiumSheetToSvg(roundTripDocument),
    sourceOffSheetPortFontSizePoints:
      getOffSheetPortFontSizePoints(sourceDocument),
    sourceSvg: convertCircuitJsonToSchematicSvg(
      sourceCircuitJson as CircuitJson,
    ),
  }
}
