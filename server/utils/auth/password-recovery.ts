import { createError, isError, type H3Event } from 'h3'
import type { DatabaseConfig } from '#server/utils/config-env'
import { createWebSocketClient } from '#server/utils/database'
import { getRuntimeDatabaseConfig } from '#server/utils/config'
import type { EmailAuthenticationConfig } from './email-registration-config'
import { sendPasswordRecoveryEmail } from './password-recovery-mail'

import {
  issuePasswordRecovery,
  revokePasswordRecoveryToken,
  type PasswordRecoveryDatabase
} from './password-recovery-persistence'

import { getAuthErrorDetails } from './telemetry'

interface PasswordRecoveryBackgroundOptions {
  binding: Env['EMAIL'];
  config: EmailAuthenticationConfig;
  databaseConfig: DatabaseConfig;
  email: string;
  redirectTo: string;
  token: string;
  tokenHash: string;
}

async function closePasswordRecoveryDatabase(
  database: PasswordRecoveryDatabase,
  sensitiveValues: readonly string[]
): Promise<void> {
  try {
    await database.$client.end()
  } catch (error) {
    const details = getAuthErrorDetails(error, sensitiveValues)

    console.error('Password recovery database close failed', { error: details })
  }
}

async function runPasswordRecoveryIssuance(options: PasswordRecoveryBackgroundOptions): Promise<void> {
  const { binding, config, databaseConfig, email, redirectTo, token, tokenHash } = options
  const sensitiveValues = [email, token, tokenHash]
  let database: PasswordRecoveryDatabase | null = null

  try {
    database = createWebSocketClient(databaseConfig)

    const isIssued = await issuePasswordRecovery(database, {
      email,
      isRecipientAllowed: config.stagingRecipient === null || config.stagingRecipient === email,
      redirectTo,
      tokenHash
    })

    if (!isIssued) {
      return
    }

    try {
      await sendPasswordRecoveryEmail(binding, config, {
        email,
        redirectTo,
        token
      })
    } catch (error) {
      try {
        await revokePasswordRecoveryToken(database, {
          email,
          tokenHash
        })
      } catch (cleanupError) {
        const cleanupDetails = getAuthErrorDetails(cleanupError, sensitiveValues)

        console.error('Password recovery token cleanup failed', { error: cleanupDetails })
      }

      throw error
    }
  } catch (error) {
    const details = getAuthErrorDetails(error, sensitiveValues)

    console.error('Password recovery request failed', { error: details })
  } finally {
    if (database !== null) {
      await closePasswordRecoveryDatabase(database, sensitiveValues)
    }
  }
}

async function withPasswordRecoveryDatabase<Result>(
  event: H3Event,
  sensitiveValues: readonly string[],
  action: (database: PasswordRecoveryDatabase) => Promise<Result>
): Promise<Result> {
  let database: PasswordRecoveryDatabase | null = null

  try {
    database = createWebSocketClient(getRuntimeDatabaseConfig(event))

    return await action(database)
  } catch (error) {
    const details = getAuthErrorDetails(error, sensitiveValues)

    console.error('Password recovery reset failed', { error: details })

    if (isError(error) && error.statusCode >= 400 && error.statusCode < 500) {
      throw createError({
        status: error.statusCode,
        statusMessage: error.statusMessage
      })
    }

    throw createError({
      cause: details,
      status: 503,
      statusMessage: 'Password recovery is temporarily unavailable. Try again'
    })
  } finally {
    if (database !== null) {
      await closePasswordRecoveryDatabase(database, sensitiveValues)
    }
  }
}

export { runPasswordRecoveryIssuance, withPasswordRecoveryDatabase }
