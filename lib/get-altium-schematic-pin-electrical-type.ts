import type { CircuitElement } from "./types"

const PASSIVE_COMPONENT_TYPES = new Set([
  "simple_resistor",
  "simple_capacitor",
  "simple_inductor",
  "simple_diode",
  "simple_led",
  "simple_fuse",
  "simple_crystal",
  "simple_resonator",
  "simple_switch",
  "simple_push_button",
  "simple_potentiometer",
  "simple_pin_header",
  "simple_connector",
  "simple_test_point",
])

export function getAltiumSchematicPinElectricalType({
  sourceComponent,
  sourcePort,
}: {
  sourceComponent: CircuitElement | undefined
  sourcePort: CircuitElement | undefined
}): number | undefined {
  if (
    typeof sourceComponent?.ftype === "string" &&
    PASSIVE_COMPONENT_TYPES.has(sourceComponent.ftype)
  ) {
    return 4
  }
  if (
    sourcePort?.provides_power === true ||
    sourcePort?.requires_power === true ||
    sourcePort?.provides_ground === true ||
    sourcePort?.requires_ground === true
  ) {
    return 7
  }
  // Circuit JSON does not always provide a signal direction. Keep Altium's
  // default for unknown pins; names and IEEE clock symbols do not establish it.
  return undefined
}
