import { type Ref, watch } from 'vue'

interface Params {
  ignore?: Ref<HTMLElement | null>[];
}

const listenerOptions = {
  capture: true,
  passive: true
} as const

export function useClickOutside(
  watchValue: Ref<boolean>,
  handler: () => void,
  params: Params = {}
) {
  function onClickOutside(event: MouseEvent) {
    const { ignore } = params
    const composedPath = event.composedPath()

    const hasIgnoredElement = ignore?.some((element) =>
      element.value !== null && composedPath.includes(element.value)
    )

    if (hasIgnoredElement === true) {
      return
    }

    handler()
  }

  watch(watchValue, (newValue, _oldValue, onCleanup) => {
    if (newValue) {
      globalThis.addEventListener('click', onClickOutside, listenerOptions)
    } else {
      globalThis.removeEventListener('click', onClickOutside, listenerOptions)
    }

    onCleanup(() => {
      globalThis.removeEventListener('click', onClickOutside, listenerOptions)
    })
  })
}
