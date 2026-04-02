import delay from 'delay'

async function withMinimumDelay<PromiseType>(
  promise: Promise<PromiseType>,
  timeout = 250
) : Promise<PromiseType> {
  const delayPromise = delay(timeout)

  await Promise.allSettled([promise, delayPromise])

  return promise
}

export { delay, withMinimumDelay }
