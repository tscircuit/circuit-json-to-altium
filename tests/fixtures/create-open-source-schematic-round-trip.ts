import { resolve } from "node:path"
import {
  AltiumPrjPcb,
  AltiumSchDoc,
  parseAltiumFile,
  serializeAltiumSheetToSvg,
} from "altiumts"
import { CircuitJsonToAltiumConverter } from "../../lib"
import { convertAltiumSchematicToCircuitJson } from "./convert-altium-schematic-to-circuit-json"
import { getSchematicRoundTripMetrics } from "./get-schematic-round-trip-metrics"

export type OpenSourceSchematicRoundTrip = ReturnType<
  typeof getSchematicRoundTripMetrics
> & {
  roundTripOffSheetPortFontSizePoints: number[]
  roundTripEmbeddedImageCount: number
  roundTripSchematicFilenames: string[]
  roundTripTemplateOwnedRecordCount: number
  roundTripTemplateRecordCount: number
  roundTripSvg: string
  sourceOffSheetPortFontSizePoints: number[]
  sourceSheetSize: { height: number; width: number }
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

function getTemplateOwnedRecordCount(document: AltiumSchDoc): number {
  const templateRecord = document.getRecordsByKind("39")[0]
  return templateRecord ? document.getOwnedRecords(templateRecord).length : 0
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

function getSourceSheetSettings(sourceSvg: string) {
  const paperClip = sourceSvg.match(
    /<clipPath id="altium-sheet-paper">([\s\S]*?)<\/clipPath>/u,
  )?.[1]
  const paperRect = paperClip?.match(/<rect\b[^>]*>/u)?.[0]
  const width = Number(paperRect?.match(/\bwidth="([\d.]+)"/u)?.[1])
  const height = Number(paperRect?.match(/\bheight="([\d.]+)"/u)?.[1])
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Could not read the rendered Altium source sheet size")
  }
  return {
    circuitOrigin: { x: 0, y: 0 },
    height: height / 20,
    width: width / 20,
  }
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
  const sourceSvg = serializeAltiumSheetToSvg(
    sourceDocument,
    sourceProjectContext,
  )
  const sourceSheetSettings = getSourceSheetSettings(sourceSvg)
  const templateContent = sourceDocument.getRecordsByKind("39")[0]
    ? sourceBytes
    : undefined
  const converter = new CircuitJsonToAltiumConverter(sourceCircuitJson, {
    projectName,
    schematicSheets: [{ ...sourceSheetSettings, templateContent }],
  })
  converter.runUntilFinished()
  const generatedOutput = converter.getOutput()
  const generatedSchematic = generatedOutput.schematics[0]
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
    roundTripEmbeddedImageCount: roundTripDocument.embeddedImages.length,
    roundTripSchematicFilenames: generatedOutput.schematics.map(
      (schematic) => schematic.filename,
    ),
    roundTripTemplateOwnedRecordCount:
      getTemplateOwnedRecordCount(roundTripDocument),
    roundTripTemplateRecordCount:
      roundTripDocument.getRecordsByKind("39").length,
    roundTripSvg: serializeAltiumSheetToSvg(roundTripDocument),
    sourceOffSheetPortFontSizePoints:
      getOffSheetPortFontSizePoints(sourceDocument),
    sourceSheetSize: {
      height: sourceSheetSettings.height,
      width: sourceSheetSettings.width,
    },
    sourceSvg,
  }
}
