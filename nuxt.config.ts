import { createHash, type BinaryLike } from 'node:crypto'
import { basename } from 'node:path'

type ComponentType = 'page' | 'layout' | 'component';

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
  compatibilityDate: '2025-12-02',

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
    '@nuxt/hints'
  ],

  experimental: {
    viewTransition: true,
    scanPageMeta: true,
    granularCachedData: true,
    viteEnvironmentApi: true,

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
    typeCheck: true,

    tsConfig: {
      compilerOptions: {
        noFallthroughCasesInSwitch: true,
        noImplicitReturns: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noUncheckedSideEffectImports: true
      }
    }
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
       * We're using new `<select>` customizations
       *
       * @see [RFC Customizable Select](https://developer.chrome.com/blog/rfc-customizable-select?hl=en)
       */
      isCustomElement: (tag) => tag === 'selectedoption'
    }
  },

  vite: {
    css: {
      modules: {
        generateScopedName(className: string, filename: string, data: BinaryLike) : string {
          const hash = createHash('sha256')
            .update(data)
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
