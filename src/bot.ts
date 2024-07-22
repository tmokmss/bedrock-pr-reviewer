import './fetch-polyfill'

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandOutput
} from '@aws-sdk/client-bedrock-runtime'
import {info, warning} from '@actions/core'
import pRetry from 'p-retry'
import {BedrockOptions, Options} from './options'

// define type to save parentMessageId and conversationId
export interface Ids {
  parentMessageId?: string
  conversationId?: string
}

export interface Message {
  role: string
  content: string
}

export class Bot {
  private readonly client: BedrockRuntimeClient

  private readonly options: Options
  private readonly bedrockOptions: BedrockOptions

  constructor(options: Options, bedrockOptions: BedrockOptions) {
    this.options = options
    this.bedrockOptions = bedrockOptions
    this.client = new BedrockRuntimeClient({})
  }

  chat = async (message: string, prefix?: string): Promise<string> => {
    let res = ''
    try {
      res = await this.chat_([
        {role: 'user', content: `${message}\n${prefix ?? ''}`}
      ])
      return `${prefix ?? ''}${res}`
    } catch (e: unknown) {
      warning(`Failed to chat: ${e}`)
      return res
    }
  }

  roleplayChat = async (prompt: Array<Message>) => {
    try {
      return await this.chat_(prompt)
    } catch (e: unknown) {
      warning(`Failed to chat: ${e}`)
      return ''
    }
  }

  private readonly chat_ = async (prompt: Array<Message>): Promise<string> => {
    // record timing
    const start = Date.now()
    if (!prompt.length) {
      return ''
    }

    let response: InvokeModelCommandOutput | undefined
    const messages = prompt.map(m => {
      return {
        role: m.role,
        content: [
          {
            type: 'text',
            text: m.content
          }
        ]
      }
    })

    try {
      if (this.options.debug) {
        info(`sending prompt: ${JSON.stringify(messages)}\n------------`)
      }
      response = await pRetry(
        () =>
          this.client.send(
            new InvokeModelCommand({
              modelId: this.bedrockOptions.model,
              body: JSON.stringify({
                // eslint-disable-next-line camelcase
                anthropic_version: 'bedrock-2023-05-31',
                // eslint-disable-next-line camelcase
                max_tokens: 4096,
                temperature: this.options.bedrockModelTemperature,
                system: `IMPORTANT: Entire response must be in the language with ISO code: ${this.options.language}`,
                messages
              }),
              contentType: 'application/json',
              accept: 'application/json'
            })
          ),
        {
          retries: this.options.bedrockRetries
        }
      )
    } catch (e: unknown) {
      info(`response: ${response}, failed to send message to bedrock: ${e}`)
    }
    const end = Date.now()
    info(
      `bedrock sendMessage (including retries) response time: ${end - start} ms`
    )

    let responseText = ''
    if (response != null) {
      responseText = JSON.parse(Buffer.from(response.body).toString('utf-8'))
        .content?.[0]?.text
    } else {
      warning('bedrock response is null')
    }
    if (this.options.debug) {
      info(`bedrock responses: ${responseText}\n-----------`)
    }

    return responseText
  }
}
