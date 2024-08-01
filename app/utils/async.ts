export function delay(timeout: number) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

export async function withMinimumDelay<P>(promise: Promise<P>, timeout = 250) : Promise<P> {
  const delayPromise = delay(timeout)

  await Promise.allSettled([promise, delayPromise])

  return promise
}
