import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, parseAltiumSchDoc } from "altiumts"
import CFB from "cfb"
import { CircuitJsonToAltiumConverter } from "../lib"
import { board, type CircuitElement } from "./fixtures"

const FREESECT = 0xffffffff
const MAXREGSECT = 0xfffffffa

function assertTrailingFatAndMiniFatEntriesAreFree(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sectorShift = view.getUint16(0x1e, true)
  const miniSectorShift = view.getUint16(0x20, true)
  const sectorSize = 1 << sectorShift
  const miniSectorSize = 1 << miniSectorShift
  const entriesPerSector = sectorSize >>> 2
  const totalSectors = (bytes.byteLength - sectorSize) / sectorSize
  expect(Number.isInteger(totalSectors)).toBe(true)

  const numFatSectors = view.getUint32(0x2c, true)
  const firstDirSector = view.getUint32(0x30, true)
  const firstMiniFatSector = view.getUint32(0x3c, true)
  const numMiniFatSectors = view.getUint32(0x40, true)

  const fatSectorIds: number[] = []
  for (let i = 0; i < 109 && fatSectorIds.length < numFatSectors; i++) {
    const sectorId = view.getUint32(0x4c + i * 4, true)
    if (sectorId <= MAXREGSECT) fatSectorIds.push(sectorId)
  }
  expect(fatSectorIds).toHaveLength(numFatSectors)

  const fatTable = new Uint32Array(totalSectors)
  let trailingFatCount = 0
  for (let fatIndex = 0; fatIndex < fatSectorIds.length; fatIndex++) {
    const fatOffset = (fatSectorIds[fatIndex]! + 1) * sectorSize
    for (let slot = 0; slot < entriesPerSector; slot++) {
      const globalSectorId = fatIndex * entriesPerSector + slot
      const value = view.getUint32(fatOffset + slot * 4, true)
      if (globalSectorId < totalSectors) {
        fatTable[globalSectorId] = value
      } else {
        expect(value).toBe(FREESECT)
        trailingFatCount++
      }
    }
  }
  expect(trailingFatCount).toBe(numFatSectors * entriesPerSector - totalSectors)

  if (numMiniFatSectors > 0 && firstMiniFatSector <= MAXREGSECT) {
    const rootEntryOffset = (firstDirSector + 1) * sectorSize
    const rootStreamSize = view.getUint32(rootEntryOffset + 0x78, true)
    const totalMiniSectors = Math.ceil(rootStreamSize / miniSectorSize)

    let miniFatSector = firstMiniFatSector
    let miniFatIndex = 0
    let trailingMiniFatCount = 0
    while (miniFatIndex < numMiniFatSectors && miniFatSector <= MAXREGSECT) {
      const miniFatOffset = (miniFatSector + 1) * sectorSize
      for (let slot = 0; slot < entriesPerSector; slot++) {
        const globalMiniSectorId = miniFatIndex * entriesPerSector + slot
        const value = view.getUint32(miniFatOffset + slot * 4, true)
        if (globalMiniSectorId >= totalMiniSectors) {
          expect(value).toBe(FREESECT)
          trailingMiniFatCount++
        }
      }
      miniFatSector = fatTable[miniFatSector] ?? FREESECT
      miniFatIndex++
    }
    expect(trailingMiniFatCount).toBe(
      numMiniFatSectors * entriesPerSector - totalMiniSectors,
    )
  }
}

test("marks FAT and MiniFAT entries past the file sector count as FREESECT in PcbDoc and SchDoc", () => {
  const outlineOnlyConverter = new CircuitJsonToAltiumConverter([
    board({ width: 50, height: 30 }),
  ])
  outlineOnlyConverter.runUntilFinished()
  const outlineOnly = outlineOnlyConverter.getOutput()

  assertTrailingFatAndMiniFatEntriesAreFree(outlineOnly.pcb.content)
  expect(parseAltiumBinaryPcbDoc(outlineOnly.pcb.content).board).toBeDefined()
  expect(
    CFB.read(outlineOnly.pcb.content, { type: "buffer" }).FullPaths.length,
  ).toBeGreaterThan(0)

  for (const schematic of outlineOnly.schematics) {
    assertTrailingFatAndMiniFatEntriesAreFree(schematic.content)
    expect(parseAltiumSchDoc(schematic.content).records.length).toBeGreaterThan(
      0,
    )
    expect(
      CFB.read(schematic.content, { type: "buffer" }).FullPaths.length,
    ).toBeGreaterThan(0)
  }

  // Exercise the CFB rewrite paths used for board cutouts and keepout clearance rules.
  const cutoutAndKeepoutElements: CircuitElement[] = [
    board({ width: 40, height: 30 }),
    {
      type: "pcb_cutout",
      pcb_cutout_id: "cutout_1",
      shape: "rect",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
    },
    { type: "source_net", source_net_id: "n1", name: "NetA" },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "keepout_1",
      shape: "rect",
      center: { x: 8, y: 0 },
      width: 3,
      height: 3,
      layers: ["top"],
      net_to_exclude: ["NetA"],
    },
  ]
  const rewrittenConverter = new CircuitJsonToAltiumConverter(
    cutoutAndKeepoutElements,
  )
  rewrittenConverter.runUntilFinished()
  const rewritten = rewrittenConverter.getOutput()

  assertTrailingFatAndMiniFatEntriesAreFree(rewritten.pcb.content)
  expect(parseAltiumBinaryPcbDoc(rewritten.pcb.content).board).toBeDefined()
})
