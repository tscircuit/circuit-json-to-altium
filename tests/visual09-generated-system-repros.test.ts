import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "altiumts"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { CircuitJsonToAltiumConverter } from "../lib"
import { expectValidSchematic } from "./fixtures"
import { createSideBySideSvg } from "./fixtures/create-side-by-side-svg"

interface GeneratedSystemRepro {
  fixtureName: string
  projectName: string
  title: string
  expectedSheetNames: string[]
}

function expectPinNameAndDesignatorBaselines(svg: string): number {
  const schematicPinGroups = svg.match(/<g data-record="2">.*?<\/g>/g) ?? []
  const pinTextBaselinesByPin = schematicPinGroups.map((pinGroup) =>
    [...pinGroup.matchAll(/dominant-baseline="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  )
  const pinsWithDesignatorAndName = pinTextBaselinesByPin.filter(
    (pinTextBaselines) => pinTextBaselines.length === 2,
  )
  for (const [designatorBaseline, nameBaseline] of pinsWithDesignatorAndName) {
    expect(designatorBaseline).toBe("text-after-edge")
    expect(nameBaseline).toBe("central")
  }
  return pinsWithDesignatorAndName.length
}

const repros: GeneratedSystemRepro[] = [
  {
    fixtureName: "generated-system-blood-pressure-monitor.circuit.json",
    projectName: "blood-pressure-monitor",
    title: "blood pressure monitor generated system",
    expectedSheetNames: [
      "Input + Reference",
      "Connectors + Jumpers + Test Points",
      "Programming",
      "INA + Filter",
      "MCU",
      "Pressure Sensor + ADC Filter",
      "Motor Driver",
    ],
  },
  {
    fixtureName: "generated-system-automotive-mirror.circuit.json",
    projectName: "automotive-mirror-system",
    title: "automotive mirror generated system",
    expectedSheetNames: [
      "TCAN1042 CAN Interface",
      "TIDA-00356 Lamp Driver",
      "TIDA-01539 Ambient Light Sensors",
      "MSPM0G3507 Microcontroller",
      "TIDA-01539 Electrochromic Mirror Driver",
      "LM74202 and TPS7E81-Q1 Power Supply",
      "LM50HV-Q1 Temperature Sensor",
    ],
  },
  {
    fixtureName: "generated-system-light-motor-control.circuit.json",
    projectName: "light-motor-control-system",
    title: "light and motor control generated system",
    expectedSheetNames: [
      "TCAN1042 CAN Interface",
      "TIDA-01330 Light Driver",
      "MSPM0L1306-Q1 Microcontroller",
      "TIDA-01330 DRV8305 Motor Driver",
      "TIDA-01389 Position Feedback",
      "TIDA-00992 LM5050-Q1 Power Supply",
    ],
  },
  {
    fixtureName: "generated-system-bluetooth-audio.circuit.json",
    projectName: "bluetooth-audio-system",
    title: "Bluetooth audio generated system",
    expectedSheetNames: [
      "TAS2505 Audio Amplifier",
      "CC2564C Bluetooth Controller",
      "MSP430F5229 Bluetooth Audio Host",
      "BQ24074 Battery Management",
      "TPS7A2018 1.8 V LDO",
    ],
  },
]

for (const repro of repros) {
  test(`reproduces the ${repro.title}`, async () => {
    const circuitJson = JSON.parse(
      await readFile(
        new URL(`./assets/${repro.fixtureName}`, import.meta.url),
        "utf8",
      ),
    ) as AnyCircuitElement[]
    const converter = new CircuitJsonToAltiumConverter(circuitJson, {
      projectName: repro.projectName,
    })
    converter.runUntilFinished()

    const sourceSheets = circuitJson
      .filter((element) => element.type === "schematic_sheet")
      .sort(
        (left, right) =>
          Number(left.sheet_index ?? 0) - Number(right.sheet_index ?? 0),
      )
    expect(
      sourceSheets.map((sheet) =>
        String(Reflect.get(sheet, "display_name") ?? sheet.name),
      ),
    ).toEqual(repro.expectedSheetNames)

    const { schematics } = converter.getOutput()
    expect(schematics.map(({ filename }) => filename)).toEqual([
      `${repro.projectName}.SchDoc`,
      ...sourceSheets.map(
        (_, index) =>
          `${repro.projectName}-${String(index + 1).padStart(2, "0")}.SchDoc`,
      ),
    ])

    const parsedSchematics = schematics.map(({ content }) =>
      parseAltiumSchDoc(content),
    )
    for (const schematic of parsedSchematics) {
      expectValidSchematic(schematic)
    }

    const rootSchematic = parsedSchematics[0]
    if (!rootSchematic) throw new Error("Converter did not create a root sheet")
    expect(
      rootSchematic.sheetLinks.map(({ fileName, name }) => ({
        fileName,
        name,
      })),
    ).toEqual(
      sourceSheets.map((sheet, index) => ({
        fileName: `${repro.projectName}-${String(index + 1).padStart(2, "0")}.SchDoc`,
        name: String(Reflect.get(sheet, "display_name") ?? sheet.name),
      })),
    )

    const snapshots = [serializeAltiumSheetToSvg(rootSchematic)]
    const snapshotNames = [`${repro.projectName}-root-hierarchy`]
    let pinNameAndDesignatorPairCount = 0
    for (const [index, sourceSheet] of sourceSheets.entries()) {
      const generatedSchematic = parsedSchematics[index + 1]
      if (!generatedSchematic) {
        throw new Error(`Missing generated child sheet ${index + 1}`)
      }
      const circuitJsonSvg = convertCircuitJsonToSchematicSvg(circuitJson, {
        schematicSheetId: String(sourceSheet.schematic_sheet_id),
      })
      const generatedSchematicSvg =
        serializeAltiumSheetToSvg(generatedSchematic)
      pinNameAndDesignatorPairCount += expectPinNameAndDesignatorBaselines(
        generatedSchematicSvg,
      )
      snapshots.push(createSideBySideSvg(circuitJsonSvg, generatedSchematicSvg))
      snapshotNames.push(
        `${repro.projectName}-${String(index + 1).padStart(2, "0")}-${String(sourceSheet.name).replaceAll("_", "-")}`,
      )
    }
    expect(pinNameAndDesignatorPairCount).toBeGreaterThan(0)

    await expect(snapshots).toMatchMultipleSvgSnapshots(
      import.meta.path,
      snapshotNames,
    )
  }, 60_000)
}
