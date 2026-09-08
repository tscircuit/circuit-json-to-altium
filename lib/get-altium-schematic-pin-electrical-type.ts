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
}): number {
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
  // Omission means Input in Altium, not Unknown. Use the non-directional
  // passive fallback when Circuit JSON supplies no electrical role. Names
  // and visual arrows must not be used to invent a device pin direction.
  return 4
}
