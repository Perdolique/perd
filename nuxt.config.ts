import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { env } from 'node:process'
import { fileURLToPath } from 'node:url'

type ComponentType = 'page' | 'layout' | 'component';

const customElements = new Set(['search']);

const modalDialogFixturePath = fileURLToPath(
  new globalThis.URL('tests/nuxt/ModalDialog.vue', import.meta.url)
)

function getComponentType(filePath: string) : ComponentType {
  if (filePath.includes('/app/pages/')) {
    return 'page';
  } else if (filePath.includes('/app/layouts/')) {
    return 'layout';
  }

  return 'component';
}

function getComponentName(componentName: string, componentType: ComponentType) : string {
  if (componentType === 'component') {
    return componentName;
  }

  return `${componentType}-${componentName}`;
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-07-18',

  runtimeConfig: {
    databaseUrl: '',
    localDatabase: '',
    sessionSecret: '',

    oauth: {
      twitch: {
        clientId: '',
        clientSecret: '',
      }
    }
  },

  css: [
    '~/assets/styles/base.css'
  ],

  modules: [
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/hints',
    '@pinia/nuxt'
  ],

  experimental: {
    viewTransition: true,

    /**
     * FIXME: Disable once @nuxt/icon and other modules
     * stop relying on Nitro auto-imports
     *
     * https://github.com/nuxt/nuxt/issues/34142
     */
    nitroAutoImports: true
  },

  future: {
    compatibilityVersion: 5
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        noFallthroughCasesInSwitch: true,
        noImplicitReturns: true,
        noUnusedLocals: true,
        noUnusedParameters: true
      }
    }
  },

  /**
   * FIXME: Re-enable after @unhead/bundler stops replacing the assignment target
   * in `head.ssr = false` with `false = false` during client builds.
   *
   * Unhead 3.2.0 fixes the Nitro failure from this issue, but not this Vite transform:
   * https://github.com/nuxt/nuxt/issues/35670
   */
  unhead: {
    vite: false
  },

  app: {
    rootAttrs: {
      class: 'perd-root'
    }
  },

  devtools: {
    enabled: true
  },

  imports: {
    autoImport: false
  },

  hooks: {
    'pages:extend': (pages) => {
      if (env.PERD_E2E_PAGES !== 'true') {
        return
      }

      pages.push({
        file: modalDialogFixturePath,
        name: 'e2e-modal-dialog',
        path: '/__e2e/modal-dialog'
      })
    }
  },

  nitro: {
    preset: 'cloudflare_module',

    cloudflare: {
      deployConfig: false
    }
  },

  icon: {
    clientBundle: {
      scan: true
    }
  },

  vue: {
    compilerOptions: {
      /**
       * Vue does not recognize these newer platform elements yet.
       */
      isCustomElement: (tag) => customElements.has(tag)
    }
  },

  vite: {
    css: {
      modules: {
        generateScopedName(className, filename, css) : string {
          const hash = createHash('sha256')
            .update(css)
            .digest('hex')
            .slice(0, 6);

          const filePath = filename
            .replace(/\.vue(?:\?.+?)?$/u, '')
            .replaceAll(/\[|\]/gu, '');

          const baseName = basename(filePath);
          const componentType = getComponentType(filePath);
          const componentName = getComponentName(baseName, componentType);

          return `${componentName}_${className}_${hash}`;
        }
      },

    }
  }
})
