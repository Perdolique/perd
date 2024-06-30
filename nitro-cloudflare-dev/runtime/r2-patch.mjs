export function patchR2Bucket(bucket) {
  let _mutex;
  const _get = bucket.get.bind(bucket);
  async function getAndRead(...args) {
    const obj = await _get(...args);
    if (!obj) {
      return obj;
    }
    const chunks = [];
    for await (const chunk of obj.body) {
      chunks.push(chunk);
    }
    const body = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });
    return { ...obj, body };
  }
  async function get(...args) {
    while (_mutex) {
      await _mutex;
    }
    try {
      _mutex = getAndRead(...args);
      const obj = await _mutex;
      return obj;
    } finally {
      _mutex = void 0;
    }
  }
  return new Proxy(bucket, {
    get(target, prop) {
      if (prop === "get") {
        return get;
      }
      return Reflect.get(target, prop);
    }
  });
}
