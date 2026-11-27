import { expect, test } from "bun:test"
import { board, extractArchive } from "./fixtures"

const FREESECT = 0xffffffff
const MAXREGSECT = 0xfffffffa
const CFB_HEADER_SIZE = 512

const getOutOfRangeFatEntries = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sectorSize = 1 << view.getUint16(30, true)
  const sectorCount = (bytes.byteLength - CFB_HEADER_SIZE) / sectorSize
  const entriesPerFatSector = sectorSize / 4
  const fatSectorCount = view.getUint32(44, true)
  const fatSectorLocations: number[] = []
  for (let index = 0; index < 109; index++) {
    const sector = view.getUint32(76 + index * 4, true)
    if (sector <= MAXREGSECT) fatSectorLocations.push(sector)
  }

  const outOfRangeEntries: Array<{ index: number; value: number }> = []
  for (
    let fatSectorIndex = 0;
    fatSectorIndex < fatSectorCount;
    fatSectorIndex++
  ) {
    const fatSectorLocation = fatSectorLocations[fatSectorIndex]
    if (fatSectorLocation === undefined) {
      throw new Error("Missing compound-file FAT sector location")
    }
    const fatSectorOffset = CFB_HEADER_SIZE + fatSectorLocation * sectorSize
    for (
      let entryOffset = 0;
      entryOffset < entriesPerFatSector;
      entryOffset++
    ) {
      const entryIndex = fatSectorIndex * entriesPerFatSector + entryOffset
      if (entryIndex < sectorCount) continue
      const value = view.getUint32(fatSectorOffset + entryOffset * 4, true)
      if (value !== FREESECT)
        outOfRangeEntries.push({ index: entryIndex, value })
    }
  }
  return outOfRangeEntries
}

test("marks FAT entries beyond the end of compound files as free", async () => {
  const result = await extractArchive(
    [board({ width: 50, height: 30 })],
    "outline-only",
  )

  for (const bytes of [
    result.pcbBytes,
    ...result.schematicSources.map((source) => source.bytes),
  ]) {
    expect(getOutOfRangeFatEntries(bytes)).toEqual([])
  }
})
