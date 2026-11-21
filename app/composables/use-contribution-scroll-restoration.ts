import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useRoute, useRouter } from '#imports'
import * as v from 'valibot'

const scrollPositionSchema = v.object({
  left: v.pipe(v.number(), v.finite()),
  top: v.pipe(v.number(), v.finite())
})

/** Reapplies the router's history position once lazy first-page results make it reachable. */
function useContributionScrollRestoration(isLoading: Ref<boolean>) {
  const route = useRoute()
  const router = useRouter()
  const initialPath = route.fullPath
  let canRestore = true

  function cancelRestoration() {
    canRestore = false
  }

  onMounted(() => {
    const savedPosition = v.safeParse(scrollPositionSchema, router.options.history.state.scroll)

    if (savedPosition.success === false) {
      return
    }

    // User input takes precedence over a delayed history restoration.
    useEventListener(globalThis.window, ['wheel', 'touchstart', 'pointerdown', 'keydown'], cancelRestoration, { passive: true })

    watch(isLoading, (loading) => {
      if (loading || canRestore === false || route.fullPath !== initialPath) {
        return
      }

      globalThis.scrollTo({
        left: savedPosition.output.left,
        top: savedPosition.output.top,
        behavior: 'instant'
      })

      canRestore = false
    }, {
      immediate: true,
      flush: 'post'
    })
  })

  watch(() => route.fullPath, cancelRestoration)
  onBeforeUnmount(cancelRestoration)
}

export { useContributionScrollRestoration }
