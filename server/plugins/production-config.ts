import { defineNitroPlugin } from 'nitropack/runtime'
import { getRuntimeTwitchConfig } from '#server/utils/oauth/twitch'

// oxlint-disable-next-line import/no-default-export -- Nitro discovers server plugins via default export.
export default defineNitroPlugin((nitroApp) => {
  const isProductionRuntime = import.meta.dev === false

  let isTwitchConfigValidated = false

  nitroApp.hooks.hook('request', (event) => {
    if (isProductionRuntime) {
      if (isTwitchConfigValidated) {
        return
      }

      getRuntimeTwitchConfig(event)

      isTwitchConfigValidated = true
    }
  })
})
