import { createHash, type BinaryLike } from 'crypto'
import { basename } from 'path'

type ComponentType = 'page' | 'layout' | 'component';

function getComponentType(filePath: string) : ComponentType {
  if (filePath.includes('/app/pages/')) {
    return 'page';
  } else if (filePath.includes('/app/layouts/')) {
    return 'layout';
  } else {
    return 'component';
  }
}

function getComponentName(componentName: string, componentType: ComponentType) : string {
  if (componentType === 'component') {
    return componentName;
  }

  return `${componentType}-${componentName}`;
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    '@nuxt/icon'
  ],

  experimental: {
    viewTransition: true,
    scanPageMeta: true,
    granularCachedData: true,
    typescriptPlugin: true,
    viteEnvironmentApi: true
  },

  future: {
    compatibilityVersion: 5
  },

  typescript: {
    typeCheck: true
  },

  app: {
    rootAttrs: {
      class: 'perd-root'
    }
  },

  devtools: {
    enabled: true
  },

  components: {
    dirs: []
  },

  compatibilityDate: '2025-10-25',

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
            .replace(/\[|\]/gu, '');

          const baseName = basename(filePath);
          const componentType = getComponentType(filePath);
          const componentName = getComponentName(baseName, componentType);

          return `${componentName}_${className}_${hash}`;
        }
      },

      preprocessorOptions: {
        scss: {
          additionalData: `
@use "~/assets/styles/media" as *;
@use "~/assets/styles/utils" as *;
`
        }
      }
    }
  }
})
