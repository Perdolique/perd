import { test as base, type ConsoleMessage, type Page } from '@playwright/test'
import { appBaseUrl } from '../constants.ts'

interface BrowserRuntimeIssue {
  message: string;
  source: string;
  type: 'console' | 'pageerror';
}

interface TurnstileFixture {
  complete: (page: Page) => Promise<void>;
  expire: (page: Page) => Promise<void>;
  failChallenge: (page: Page) => Promise<void>;
  timeout: (page: Page) => Promise<void>;
  replayRemovedCallbacks: (page: Page) => Promise<void>;
  failScriptLoad: (page: Page) => Promise<void>;
  getRenderOptions: (page: Page) => Promise<unknown[]>;
  pause: (page: Page) => Promise<void>;
  pauseAutomatically: (page: Page) => Promise<void>;
}

interface TestFixtures {
  turnstile: TurnstileFixture;
}

const appOrigin = new globalThis.URL(appBaseUrl).origin
const frameworkWarningPattern = /(?:\[Vue warn\]|Failed to resolve component|Hydration)/u
const turnstileScriptOrigin = 'https://challenges.cloudflare.com'
const turnstileScriptPath = '/turnstile/v0/api.js'

const turnstileMockScript = String.raw`
(() => {
  let nextTokenId = 0;
  let nextWidgetId = 0;
  const widgets = new Map();
  const pendingWidgetIds = new Set();
  const solvedWidgetIds = new Set();
  const renderOptions = [];
  const widgetElements = new Map();
  const removedWidgets = [];

  const state = {
    renderOptions
  };

  function issueToken(widgetId) {
    const options = widgets.get(widgetId);

    if (!options || solvedWidgetIds.has(widgetId)) {
      return;
    }

    solvedWidgetIds.add(widgetId);
    nextTokenId += 1;
    const token = 'turnstile-token-' + nextTokenId;

    queueMicrotask(() => options.callback(token));
  }

  function requestToken(widgetId) {
    if (globalThis.__turnstileAutoComplete === false) {
      pendingWidgetIds.add(widgetId);
      if (globalThis.__turnstileInteractionRequired !== false) {
        widgetElements.get(widgetId).hidden = false;
        widgets.get(widgetId)['before-interactive-callback']?.();
      }
    } else {
      issueToken(widgetId);
    }
  }

  globalThis.__turnstileMock = state;
  globalThis.__turnstileComplete = () => {
    for (const widgetId of pendingWidgetIds) {
      pendingWidgetIds.delete(widgetId);
      issueToken(widgetId);
    }
  };

  globalThis.__turnstileExpire = () => {
    for (const options of widgets.values()) {
      options['expired-callback']();
    }
  };

  globalThis.__turnstileFail = () => {
    for (const options of widgets.values()) {
      options['error-callback']('110600');
    }
  };

  globalThis.__turnstileTimeout = () => {
    for (const options of widgets.values()) {
      options['timeout-callback']();
    }
  };

  globalThis.__turnstileReplayRemoved = () => {
    const options = removedWidgets.at(-1);

    if (!options) {
      throw new Error('No removed Turnstile widget is available');
    }

    options['before-interactive-callback']();
    options['error-callback']('110600');
    options['timeout-callback']();
    options['expired-callback']();
    options.callback('turnstile-stale-token');
  };

  globalThis.turnstile = {
    remove(widgetId) {
      removedWidgets.push(widgets.get(widgetId));
      widgetElements.get(widgetId)?.remove();
      widgetElements.delete(widgetId);
      widgets.delete(widgetId);
      pendingWidgetIds.delete(widgetId);
      solvedWidgetIds.delete(widgetId);
    },

    render(container, options) {
      nextWidgetId += 1;
      const widgetId = 'turnstile-widget-' + nextWidgetId;

      widgets.set(widgetId, options);

      const element = document.createElement('div');
      element.hidden = true;
      element.style.minWidth = '300px';
      element.style.height = '65px';
      element.textContent = 'Turnstile challenge';
      container.appendChild(element);
      widgetElements.set(widgetId, element);
      renderOptions.push({
        action: options.action,
        appearance: options.appearance,
        execution: options.execution,
        responseField: options['response-field'],
        sitekey: options.sitekey,
        size: options.size
      });

      if (options.execution !== 'execute') {
        requestToken(widgetId);
      }

      return widgetId;
    },

    execute(widgetId) {
      requestToken(widgetId);
    }
  };
})();
`

function isApplicationConsoleMessage(message: ConsoleMessage) {
  const sourceUrl = message.location().url

  if (sourceUrl === '') {
    return true
  }

  try {
    return new globalThis.URL(sourceUrl).origin === appOrigin
  } catch {
    return true
  }
}

function isUnexpectedConsoleMessage(message: ConsoleMessage) {
  if (!isApplicationConsoleMessage(message)) {
    return false
  }

  if (message.type() === 'error') {
    return !message.text().startsWith('Failed to load resource:')
  }

  return message.type() === 'warning' && frameworkWarningPattern.test(message.text())
}

async function getTurnstileStateArray(page: Page, propertyName: string): Promise<unknown[]> {
  const propertyValue: unknown = await page.evaluate((name) => {
    const state: unknown = Reflect.get(globalThis, '__turnstileMock')

    if (state === null || typeof state !== 'object') {
      throw new TypeError('Turnstile mock state is unavailable')
    }

    const value: unknown = Reflect.get(state, name)

    return value
  }, propertyName)

  if (!Array.isArray(propertyValue)) {
    throw new TypeError(`Turnstile mock property ${propertyName} is not an array`)
  }

  return propertyValue.map((value: unknown) => value)
}

async function invokeTurnstileCallback(page: Page, callbackName: string) {
  await page.evaluate((name) => {
    const callback: unknown = Reflect.get(globalThis, name)

    if (typeof callback !== 'function') {
      throw new TypeError(`Turnstile callback ${name} is unavailable`)
    }

    Reflect.apply(callback, globalThis, [])
  }, callbackName)
}

const test = base.extend<TestFixtures>({
  context: async ({ context }, use) => {
    const unmockedApiRequests = new Set<string>()

    await context.route(
      url => url.origin === turnstileScriptOrigin && url.pathname === turnstileScriptPath,
      async (route) => {
        await route.fulfill({
          body: turnstileMockScript,
          contentType: 'application/javascript',
          status: 200
        })
      }
    )

    await context.route((url) => {
      const isApplicationOrigin = url.origin === appOrigin
      const isApiRequest = url.pathname.startsWith('/api/')
      const isNuxtIconRequest = url.pathname.startsWith('/api/_nuxt_icon/')

      return isApplicationOrigin && isApiRequest && !isNuxtIconRequest
    }, async (route) => {
      const request = route.request()
      const requestUrlValue = request.url()
      const requestUrl = new globalThis.URL(requestUrlValue)
      const requestTarget = `${request.method()} ${requestUrl.pathname}${requestUrl.search}`

      unmockedApiRequests.add(requestTarget)

      await route.abort('blockedbyclient')
    })

    await use(context)

    if (unmockedApiRequests.size > 0) {
      const requestList = [...unmockedApiRequests].join('\n')

      throw new Error(`Unmocked application API requests reached the E2E server:\n${requestList}`)
    }
  },

  page: async ({ page }, use) => {
    const runtimeIssues: BrowserRuntimeIssue[] = []

    page.on('console', (message) => {
      if (!isUnexpectedConsoleMessage(message)) {
        return
      }

      runtimeIssues.push({
        message: message.text(),
        source: message.location().url,
        type: 'console'
      })
    })

    page.on('pageerror', (error) => {
      runtimeIssues.push({
        message: error.message,
        source: error.stack ?? '',
        type: 'pageerror'
      })
    })

    await use(page)

    if (runtimeIssues.length > 0) {
      const issueReport = JSON.stringify(runtimeIssues, null, 2)

      throw new Error(`Unexpected application errors or framework warnings in the browser:\n${issueReport}`)
    }
  },

  turnstile: async ({ context: _context }, use) => {
    await use({
      async complete(page) {
        await page.waitForFunction(() => {
          const state: unknown = Reflect.get(globalThis, '__turnstileMock')

          if (state === null || typeof state !== 'object') {
            return false
          }

          const complete: unknown = Reflect.get(globalThis, '__turnstileComplete')
          const renderOptions: unknown = Reflect.get(state, 'renderOptions')

          return typeof complete === 'function'
            && Array.isArray(renderOptions)
            && renderOptions.length > 0
        })

        await page.evaluate(() => {
          const complete: unknown = Reflect.get(globalThis, '__turnstileComplete')

          if (typeof complete !== 'function') {
            throw new TypeError('Turnstile completion callback is unavailable')
          }

          Reflect.apply(complete, globalThis, [])
        })
      },

      async expire(page) {
        await page.evaluate(() => {
          const expire: unknown = Reflect.get(globalThis, '__turnstileExpire')

          if (typeof expire !== 'function') {
            throw new TypeError('Turnstile expiry callback is unavailable')
          }

          Reflect.apply(expire, globalThis, [])
        })
      },

      async failChallenge(page) {
        await invokeTurnstileCallback(page, '__turnstileFail')
      },

      async timeout(page) {
        await invokeTurnstileCallback(page, '__turnstileTimeout')
      },

      async replayRemovedCallbacks(page) {
        await invokeTurnstileCallback(page, '__turnstileReplayRemoved')
      },

      async failScriptLoad(page) {
        await page.route(
          url => url.origin === turnstileScriptOrigin && url.pathname === turnstileScriptPath,
          async (route) => {
            await route.abort('failed')
          }
        )
      },

      async getRenderOptions(page) {
        await page.waitForFunction(() => {
          const state: unknown = Reflect.get(globalThis, '__turnstileMock')

          if (state === null || typeof state !== 'object') {
            return false
          }

          const renderOptions: unknown = Reflect.get(state, 'renderOptions')

          return Array.isArray(renderOptions) && renderOptions.length > 0
        })

        return getTurnstileStateArray(page, 'renderOptions')
      },

      async pause(page) {
        await page.addInitScript(() => {
          Reflect.set(globalThis, '__turnstileAutoComplete', false)
        })
      },

      async pauseAutomatically(page) {
        await page.addInitScript(() => {
          Reflect.set(globalThis, '__turnstileAutoComplete', false)
          Reflect.set(globalThis, '__turnstileInteractionRequired', false)
        })
      }
    })
  }
})

export { expect } from '@playwright/test'
export { test }
