const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const
const HEADER_DIFAT_OFFSET = 0x4c
const HEADER_DIFAT_COUNT = 109
const MAXREGSECT = 0xfffffffa
const ENDOFCHAIN = 0xfffffffe
const FREESECT = 0xffffffff

function hasCompoundFileSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 512) return false
  for (let index = 0; index < CFB_SIGNATURE.length; index++) {
    if (bytes[index] !== CFB_SIGNATURE[index]) return false
  }
  return true
}

/**
 * SheetJS `cfb` pads trailing entries in the final FAT and MiniFAT sectors with
 * `ENDOFCHAIN` (`0xFFFFFFFE`) instead of `FREESECT` (`0xFFFFFFFF`), violating
 * [MS-CFB] sections 2.3 and 2.4 and causing strict compound-file readers to
 * reject `.PcbDoc` and `.SchDoc` files. Rewrite unallocated trailing slots past
 * the file's actual sector and mini-sector counts to `FREESECT`.
 */
export function normalizeCompoundFileFatSectors(bytes: Uint8Array): Uint8Array {
  if (!hasCompoundFileSignature(bytes)) return bytes

  const output = new Uint8Array(bytes)
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength)

  const majorVersion = view.getUint16(0x1a, true)
  const sectorShift = view.getUint16(0x1e, true)
  const miniSectorShift = view.getUint16(0x20, true)
  if (sectorShift !== 9 && sectorShift !== 12) return output

  const sectorSize = 1 << sectorShift
  const miniSectorSize = 1 << miniSectorShift
  if (output.byteLength < sectorSize) return output

  const entriesPerSector = sectorSize >>> 2
  const totalSectors = Math.floor((output.byteLength - sectorSize) / sectorSize)

  const numFatSectors = view.getUint32(0x2c, true)
  const firstDirSector = view.getUint32(0x30, true)
  const firstMiniFatSector = view.getUint32(0x3c, true)
  const numMiniFatSectors = view.getUint32(0x40, true)
  let difatSector = view.getUint32(0x44, true)
  const numDifatSectors = view.getUint32(0x48, true)

  const fatSectorIds: number[] = []
  for (
    let index = 0;
    index < HEADER_DIFAT_COUNT && fatSectorIds.length < numFatSectors;
    index++
  ) {
    const sectorId = view.getUint32(HEADER_DIFAT_OFFSET + index * 4, true)
    if (sectorId === ENDOFCHAIN || sectorId === FREESECT) break
    if (sectorId <= MAXREGSECT && sectorId < totalSectors) {
      fatSectorIds.push(sectorId)
    }
  }

  let visitedDifatSectors = 0
  while (
    visitedDifatSectors < numDifatSectors &&
    fatSectorIds.length < numFatSectors &&
    difatSector <= MAXREGSECT &&
    difatSector < totalSectors
  ) {
    const difatOffset = (difatSector + 1) * sectorSize
    for (
      let slot = 0;
      slot < entriesPerSector - 1 && fatSectorIds.length < numFatSectors;
      slot++
    ) {
      const sectorId = view.getUint32(difatOffset + slot * 4, true)
      if (sectorId <= MAXREGSECT && sectorId < totalSectors) {
        fatSectorIds.push(sectorId)
      }
    }
    difatSector = view.getUint32(difatOffset + (entriesPerSector - 1) * 4, true)
    visitedDifatSectors++
  }

  const fatTable = new Uint32Array(totalSectors)
  fatTable.fill(FREESECT)

  for (let fatIndex = 0; fatIndex < fatSectorIds.length; fatIndex++) {
    const fatOffset = (fatSectorIds[fatIndex]! + 1) * sectorSize
    for (let slot = 0; slot < entriesPerSector; slot++) {
      const globalSectorId = fatIndex * entriesPerSector + slot
      const entryOffset = fatOffset + slot * 4
      if (globalSectorId < totalSectors) {
        fatTable[globalSectorId] = view.getUint32(entryOffset, true)
      } else if (view.getUint32(entryOffset, true) === ENDOFCHAIN) {
        view.setUint32(entryOffset, FREESECT, true)
      }
    }
  }

  if (
    numMiniFatSectors > 0 &&
    firstMiniFatSector <= MAXREGSECT &&
    firstMiniFatSector < totalSectors &&
    firstDirSector <= MAXREGSECT &&
    firstDirSector < totalSectors
  ) {
    const rootEntryOffset = (firstDirSector + 1) * sectorSize
    const rootEntryType = output[rootEntryOffset + 0x42]
    if (rootEntryType === 5 && rootEntryOffset + 0x80 <= output.byteLength) {
      const rootStreamSize =
        majorVersion === 4
          ? Number(view.getBigUint64(rootEntryOffset + 0x78, true))
          : view.getUint32(rootEntryOffset + 0x78, true)
      const totalMiniSectors = Math.ceil(rootStreamSize / miniSectorSize)

      let miniFatSector = firstMiniFatSector
      let miniFatIndex = 0
      const seenMiniFat = new Set<number>()
      while (
        miniFatIndex < numMiniFatSectors &&
        miniFatSector <= MAXREGSECT &&
        miniFatSector < totalSectors &&
        !seenMiniFat.has(miniFatSector)
      ) {
        seenMiniFat.add(miniFatSector)
        const miniFatOffset = (miniFatSector + 1) * sectorSize
        for (let slot = 0; slot < entriesPerSector; slot++) {
          const globalMiniSectorId = miniFatIndex * entriesPerSector + slot
          if (globalMiniSectorId >= totalMiniSectors) {
            const entryOffset = miniFatOffset + slot * 4
            if (view.getUint32(entryOffset, true) === ENDOFCHAIN) {
              view.setUint32(entryOffset, FREESECT, true)
            }
          }
        }
        miniFatSector = fatTable[miniFatSector] ?? FREESECT
        miniFatIndex++
      }
    }
  }

  return output
}
