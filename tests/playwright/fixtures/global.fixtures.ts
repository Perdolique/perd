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
