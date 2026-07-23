import { sleep } from './forum.ts'

export interface ConcurrentProcessorOptions<T> {
  items: T[]
  concurrency: number
  startDelayMs: number
  processItem: (item: T, index: number) => Promise<void>
}

export async function processWithConcurrency<T>({
  items,
  concurrency,
  startDelayMs,
  processItem,
}: ConcurrentProcessorOptions<T>): Promise<void> {
  let nextIndex = 0
  let started = 0
  let startGate = Promise.resolve()

  async function waitForStartTurn(): Promise<void> {
    let release!: () => void
    const previousGate = startGate
    startGate = new Promise((resolve) => {
      release = resolve
    })

    await previousGate
    if (started > 0) await sleep(startDelayMs)
    started += 1
    release()
  }

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await waitForStartTurn()
      await processItem(items[index], index)
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
