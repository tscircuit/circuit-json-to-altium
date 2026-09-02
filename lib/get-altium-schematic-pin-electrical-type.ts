import type { CircuitElement } from "./types"

const ALTIUM_PIN_ELECTRICAL_INPUT = 0
const ALTIUM_PIN_ELECTRICAL_INPUT_OUTPUT = 1
const ALTIUM_PIN_ELECTRICAL_OUTPUT = 2
const ALTIUM_PIN_ELECTRICAL_OPEN_COLLECTOR = 3
const ALTIUM_PIN_ELECTRICAL_PASSIVE = 4
const ALTIUM_PIN_ELECTRICAL_POWER = 7

export function getAltiumSchematicPinElectricalType({
  schematicPort,
  sourcePort,
}: {
  schematicPort: CircuitElement
  sourcePort: CircuitElement | undefined
}): number {
  if (
    sourcePort?.provides_power === true ||
    sourcePort?.requires_power === true ||
    sourcePort?.provides_ground === true ||
    sourcePort?.requires_ground === true ||
    sourcePort?.provides_voltage !== undefined ||
    sourcePort?.requires_voltage !== undefined
  ) {
    return ALTIUM_PIN_ELECTRICAL_POWER
  }
  if (
    schematicPort.has_input_arrow === true &&
    schematicPort.has_output_arrow === true
  ) {
    return ALTIUM_PIN_ELECTRICAL_INPUT_OUTPUT
  }
  if (sourcePort?.is_using_open_drain === true) {
    return ALTIUM_PIN_ELECTRICAL_OPEN_COLLECTOR
  }
  if (
    schematicPort.has_output_arrow === true ||
    sourcePort?.is_using_push_pull === true
  ) {
    return ALTIUM_PIN_ELECTRICAL_OUTPUT
  }
  if (schematicPort.has_input_arrow === true) {
    return ALTIUM_PIN_ELECTRICAL_INPUT
  }
  return ALTIUM_PIN_ELECTRICAL_PASSIVE
}
