import { CircuitJsonToAltiumConverter } from "./circuit-json-to-altium-converter"
import type { CircuitJsonInput } from "./types"

export async function convertCircuitJsonToAltiumZip(
  circuitJson: CircuitJsonInput,
  projectName: string,
): Promise<Uint8Array> {
  const converter = new CircuitJsonToAltiumConverter(circuitJson, {
    projectName,
  })
  converter.runUntilFinished()
  return converter.getOutputZip()
}
