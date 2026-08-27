import { serializeAltiumPcbDocToBinary } from "altiumts"
import CFB from "cfb"

const REGION_RECORD_PATTERN = /(?:^|\|)RECORD=Region(?:\||$)/iu
const BOARD_CUTOUT_FIELD_PATTERN = /\|ISBOARDCUTOUT=TRUE(?=\||$)/giu
const REGION_STREAM_PATH = "/ShapeBasedRegions6/Data"
const REGION_OBJECT_ID = 11
const REGION_PROPERTY_LENGTH_OFFSET = 18
const REGION_PROPERTY_START_OFFSET = 22
const BOARD_CUTOUT_PROPERTY = new TextEncoder().encode("|ISBOARDCUTOUT=TRUE")

type PreparedPcbSource = {
  cutoutRegionIndexes: Set<number>
  source: string
}

/**
 * Serializes an ASCII PcbDoc while retaining the native board-cutout flag.
 *
 * The pinned altiumts serializer writes region contours correctly, but its
 * region property block currently omits ISBOARDCUTOUT. Add that property to
 * the selected region payloads and update their binary framing before writing
 * the compound document.
 */
export function serializeAltiumPcbDocWithBoardCutouts(
  asciiSource: string,
): Uint8Array {
  const { cutoutRegionIndexes, source } = preparePcbSource(asciiSource)
  const serialized = serializeAltiumPcbDocToBinary(source)
  if (cutoutRegionIndexes.size === 0) return serialized

  const compoundFile = CFB.read(serialized, { type: "buffer" })
  const regionStream = CFB.find(compoundFile, REGION_STREAM_PATH)
  if (!regionStream) {
    throw new Error(`Altium PCB is missing ${REGION_STREAM_PATH}`)
  }

  const markedRegions = markBoardCutoutRegions(
    Uint8Array.from(regionStream.content),
    cutoutRegionIndexes,
  )
  if (markedRegions.count !== cutoutRegionIndexes.size) {
    throw new Error(
      `Expected to mark ${cutoutRegionIndexes.size} Altium board-cutout regions, marked ${markedRegions.count}`,
    )
  }

  regionStream.content = markedRegions.stream
  regionStream.size = markedRegions.stream.byteLength
  return new Uint8Array(
    CFB.write(compoundFile, { fileType: "cfb", type: "buffer" }),
  )
}

function preparePcbSource(asciiSource: string): PreparedPcbSource {
  let regionIndex = 0
  const cutoutRegionIndexes = new Set<number>()
  const lines = asciiSource.split(/(?<=\n)/u).map((line) => {
    if (!REGION_RECORD_PATTERN.test(line)) return line
    const currentRegionIndex = regionIndex++
    if (!BOARD_CUTOUT_FIELD_PATTERN.test(line)) return line
    BOARD_CUTOUT_FIELD_PATTERN.lastIndex = 0
    cutoutRegionIndexes.add(currentRegionIndex)
    return line.replace(BOARD_CUTOUT_FIELD_PATTERN, "")
  })
  BOARD_CUTOUT_FIELD_PATTERN.lastIndex = 0
  return { cutoutRegionIndexes, source: lines.join("") }
}

function markBoardCutoutRegions(
  stream: Uint8Array,
  cutoutRegionIndexes: ReadonlySet<number>,
): { count: number; stream: Uint8Array } {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)
  const records: Uint8Array[] = []
  let offset = 0
  let regionIndex = 0
  let markedRegionCount = 0

  while (offset < stream.byteLength) {
    if (stream.byteLength - offset < 5) {
      throw new Error("Truncated Altium region record header")
    }
    const objectId = view.getUint8(offset)
    const payloadLength = view.getUint32(offset + 1, true)
    const payloadStart = offset + 5
    const payloadEnd = payloadStart + payloadLength
    if (payloadEnd > stream.byteLength) {
      throw new Error("Truncated Altium region record payload")
    }
    if (objectId !== REGION_OBJECT_ID) {
      throw new Error(`Unexpected Altium region object ID ${objectId}`)
    }

    const originalPayload = stream.subarray(payloadStart, payloadEnd)
    const payload = cutoutRegionIndexes.has(regionIndex)
      ? addBoardCutoutProperty(originalPayload, regionIndex)
      : originalPayload
    if (payload !== originalPayload) markedRegionCount++
    records.push(createFramedRegionRecord(objectId, payload))

    regionIndex++
    offset = payloadEnd
  }

  const markedStream = new Uint8Array(
    records.reduce((total, record) => total + record.byteLength, 0),
  )
  let outputOffset = 0
  for (const record of records) {
    markedStream.set(record, outputOffset)
    outputOffset += record.byteLength
  }
  return { count: markedRegionCount, stream: markedStream }
}

function addBoardCutoutProperty(
  payload: Uint8Array,
  regionIndex: number,
): Uint8Array {
  if (payload.byteLength < REGION_PROPERTY_START_OFFSET) {
    throw new Error(`Altium region ${regionIndex} has no property block`)
  }
  const payloadView = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const propertyLength = payloadView.getUint32(
    REGION_PROPERTY_LENGTH_OFFSET,
    true,
  )
  const propertyEnd = REGION_PROPERTY_START_OFFSET + propertyLength
  if (propertyLength < 1 || propertyEnd > payload.byteLength) {
    throw new Error(
      `Altium region ${regionIndex} has an invalid property block`,
    )
  }
  const propertyTerminatorOffset = propertyEnd - 1
  if (payload[propertyTerminatorOffset] !== 0) {
    throw new Error(
      `Altium region ${regionIndex} has an unterminated property block`,
    )
  }

  const markedPayload = new Uint8Array(
    payload.byteLength + BOARD_CUTOUT_PROPERTY.byteLength,
  )
  markedPayload.set(payload.subarray(0, propertyTerminatorOffset), 0)
  markedPayload.set(BOARD_CUTOUT_PROPERTY, propertyTerminatorOffset)
  markedPayload.set(
    payload.subarray(propertyTerminatorOffset),
    propertyTerminatorOffset + BOARD_CUTOUT_PROPERTY.byteLength,
  )
  new DataView(markedPayload.buffer).setUint32(
    REGION_PROPERTY_LENGTH_OFFSET,
    propertyLength + BOARD_CUTOUT_PROPERTY.byteLength,
    true,
  )
  return markedPayload
}

function createFramedRegionRecord(
  objectId: number,
  payload: Uint8Array,
): Uint8Array {
  const record = new Uint8Array(payload.byteLength + 5)
  const view = new DataView(record.buffer)
  view.setUint8(0, objectId)
  view.setUint32(1, payload.byteLength, true)
  record.set(payload, 5)
  return record
}
