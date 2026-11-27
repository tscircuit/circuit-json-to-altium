const CFB_HEADER_SIZE = 512
const COMPOUND_FILE_MAGIC = Uint8Array.of(
  0xd0,
  0xcf,
  0x11,
  0xe0,
  0xa1,
  0xb1,
  0x1a,
  0xe1,
)
const ENDOFCHAIN = 0xfffffffe
const FREESECT = 0xffffffff
const MAXREGSECT = 0xfffffffa

export function normalizeCompoundFileFreeSectors(
  bytes: Uint8Array,
): Uint8Array {
  if (bytes.byteLength < CFB_HEADER_SIZE) {
    throw new Error("Compound file is shorter than its header")
  }
  const inputView = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  )
  for (const [index, value] of COMPOUND_FILE_MAGIC.entries()) {
    if (inputView.getUint8(index) !== value) {
      throw new Error("Invalid compound-file signature")
    }
  }
  const sectorShift = inputView.getUint16(30, true)
  if (sectorShift !== 9 && sectorShift !== 12) {
    throw new Error(`Unsupported compound-file sector shift ${sectorShift}`)
  }
  const sectorSize = 1 << sectorShift
  const sectorBytes = bytes.byteLength - CFB_HEADER_SIZE
  if (sectorBytes % sectorSize !== 0) {
    throw new Error("Compound-file sectors are truncated")
  }
  const sectorCount = sectorBytes / sectorSize
  const entriesPerFatSector = sectorSize / 4
  const fatSectorCount = inputView.getUint32(44, true)
  const fatSectorLocations: number[] = []
  for (let index = 0; index < 109; index++) {
    const sector = inputView.getUint32(76 + index * 4, true)
    if (sector <= MAXREGSECT) fatSectorLocations.push(sector)
  }

  let nextDifatSector = inputView.getUint32(68, true)
  const difatSectorCount = inputView.getUint32(72, true)
  for (let index = 0; index < difatSectorCount; index++) {
    if (nextDifatSector === ENDOFCHAIN || nextDifatSector >= sectorCount) {
      throw new Error("Compound file has a truncated DIFAT chain")
    }
    const difatSectorOffset = CFB_HEADER_SIZE + nextDifatSector * sectorSize
    for (
      let entryIndex = 0;
      entryIndex < entriesPerFatSector - 1;
      entryIndex++
    ) {
      const sector = inputView.getUint32(
        difatSectorOffset + entryIndex * 4,
        true,
      )
      if (sector <= MAXREGSECT) fatSectorLocations.push(sector)
    }
    nextDifatSector = inputView.getUint32(
      difatSectorOffset + sectorSize - 4,
      true,
    )
  }
  if (fatSectorLocations.length < fatSectorCount) {
    throw new Error("Compound file is missing FAT sector locations")
  }

  const outOfRangeEntryOffsets: number[] = []
  for (
    let fatSectorIndex = 0;
    fatSectorIndex < fatSectorCount;
    fatSectorIndex++
  ) {
    const fatSectorLocation = fatSectorLocations[fatSectorIndex]!
    if (fatSectorLocation >= sectorCount) {
      throw new Error("Compound-file FAT sector is outside the file")
    }
    const fatSectorOffset = CFB_HEADER_SIZE + fatSectorLocation * sectorSize
    for (let entryIndex = 0; entryIndex < entriesPerFatSector; entryIndex++) {
      const sectorIndex = fatSectorIndex * entriesPerFatSector + entryIndex
      if (sectorIndex < sectorCount) continue
      const entryOffset = fatSectorOffset + entryIndex * 4
      if (inputView.getUint32(entryOffset, true) !== FREESECT) {
        outOfRangeEntryOffsets.push(entryOffset)
      }
    }
  }
  if (outOfRangeEntryOffsets.length === 0) return bytes

  const normalized = new Uint8Array(bytes)
  const outputView = new DataView(normalized.buffer)
  for (const entryOffset of outOfRangeEntryOffsets) {
    outputView.setUint32(entryOffset, FREESECT, true)
  }
  return normalized
}
