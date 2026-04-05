/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'

function createTestEvent(dbHttp: unknown) {
  const request = new IncomingMessage(new Socket())
  const response = new ServerResponse(request)
  const event = createEvent(request, response)

  Object.assign(event.context, { dbHttp })

  return event
}

export {
  createTestEvent
}
