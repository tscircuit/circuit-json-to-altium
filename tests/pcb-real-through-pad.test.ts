import { expect, test } from "bun:test"
import { serializeAltiumPcbToSvg } from "altiumts"
import { type CircuitElement, extractArchive } from "./fixtures"

async function scenario() {
  const original = (await Bun.file(
    new URL("./assets/nema17.circuit.json", import.meta.url),
  ).json()) as CircuitElement[]
  const normalized = structuredClone(original)
  const trace = normalized.find(
    (element) => element.pcb_trace_id === "source_net_0_retained_160",
  )!
  const route = trace.route as Record<string, unknown>[]
  // These wire endpoints are already supplied by through_pad start/end.
  trace.route = route.filter(
    (point, i) =>
      point.route_type !== "wire" ||
      i === 0 ||
      i === route.length - 1 ||
      (route[i - 1]?.route_type !== "through_pad" &&
        route[i + 1]?.route_type !== "through_pad"),
  )
  return {
    baseline: await extractArchive(original),
    actual: await extractArchive(normalized),
  }
}

test.failing("equivalent real-board through-pad routes preserve all copper", async () => {
  const { baseline, actual } = await scenario()
  expect(
    Buffer.from(actual.pcbBytes).equals(Buffer.from(baseline.pcbBytes)),
  ).toBe(true)
}, 30_000)

test("snapshots the affected real plated-hole route", async () => {
  const { baseline, actual } = await scenario()
  const corners = baseline.pcb
    .getRecordsByKind("Pad")
    .filter(
      (pad) =>
        pad.get("PLATED") === "TRUE" &&
        (pad.getAltiumMeasurement("HOLESIZE")?.toMils() ?? 0) > 0,
    )
    .slice(2, 6)
  const xs = corners.map((pad) => pad.getAltiumMeasurement("X")!.toMils())
  const ys = corners.map((pad) => pad.getAltiumMeasurement("Y")!.toMils())
  const options = {
    width: 540,
    height: 420,
    showBoardOutline: false,
    layers: ["TOP", "MID-LAYER1", "MID-LAYER2"],
    viewBox: {
      x: Math.min(...xs) - 40,
      y: Math.min(...ys) - 40,
      width: Math.max(...xs) - Math.min(...xs) + 80,
      height: Math.max(...ys) - Math.min(...ys) + 80,
    },
  }
  await expect(serializeAltiumPcbToSvg(actual.pcb, options)).toMatchSvgSnapshot(
    import.meta.path,
  )
}, 30_000)
