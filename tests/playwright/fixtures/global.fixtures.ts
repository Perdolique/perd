import { test as base, type ConsoleMessage } from '@playwright/test'
import { appBaseUrl } from '../constants.ts'

interface BrowserRuntimeIssue {
  message: string;
  source: string;
  type: 'console' | 'pageerror';
}

const appOrigin = new globalThis.URL(appBaseUrl).origin
const frameworkWarningPattern = /(?:\[Vue warn\]|Failed to resolve component|Hydration)/u

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

const test = base.extend({
  context: async ({ context }, use) => {
    const unmockedApiRequests = new Set<string>()

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
  }
})

export { expect } from '@playwright/test'
export { test }
