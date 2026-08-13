export class TraceConnectivity {
  private readonly parentByTraceIndex: number[]

  constructor(traceCount: number) {
    this.parentByTraceIndex = Array.from(
      { length: traceCount },
      (_, traceIndex) => traceIndex,
    )
  }

  getRoot(traceIndex: number): number {
    if (
      !Number.isInteger(traceIndex) ||
      traceIndex < 0 ||
      traceIndex >= this.parentByTraceIndex.length
    ) {
      throw new RangeError(`Unknown trace index: ${traceIndex}`)
    }
    let rootTraceIndex = traceIndex
    let parentTraceIndex = this.parentByTraceIndex[rootTraceIndex]
    while (parentTraceIndex !== rootTraceIndex) {
      if (parentTraceIndex === undefined) {
        throw new RangeError(`Unknown trace index: ${rootTraceIndex}`)
      }
      rootTraceIndex = parentTraceIndex
      parentTraceIndex = this.parentByTraceIndex[rootTraceIndex]
    }
    let currentTraceIndex = traceIndex
    while (this.parentByTraceIndex[currentTraceIndex] !== currentTraceIndex) {
      const nextTraceIndex = this.parentByTraceIndex[currentTraceIndex]
      if (nextTraceIndex === undefined) {
        throw new RangeError(`Unknown trace index: ${currentTraceIndex}`)
      }
      this.parentByTraceIndex[currentTraceIndex] = rootTraceIndex
      currentTraceIndex = nextTraceIndex
    }
    return rootTraceIndex
  }

  connect(leftTraceIndex: number, rightTraceIndex: number): void {
    const leftRootTraceIndex = this.getRoot(leftTraceIndex)
    const rightRootTraceIndex = this.getRoot(rightTraceIndex)
    if (leftRootTraceIndex === rightRootTraceIndex) return
    const rootTraceIndex = Math.min(leftRootTraceIndex, rightRootTraceIndex)
    this.parentByTraceIndex[leftRootTraceIndex] = rootTraceIndex
    this.parentByTraceIndex[rightRootTraceIndex] = rootTraceIndex
  }
}
