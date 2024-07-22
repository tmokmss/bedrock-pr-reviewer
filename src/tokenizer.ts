// eslint-disable-next-line camelcase
import {get_encoding} from '@dqbd/tiktoken'
import {Message} from './bot'

const tokenizer = get_encoding('cl100k_base')

export function encode(input: string): Uint32Array {
  return tokenizer.encode(input)
}

export function getTokenCount(input: string): number {
  input = input.replace(/<\|endoftext\|>/g, '')
  return encode(input).length
}

export function getTokenCountRolePlay(input: Array<Message>): number {
  const raw = input.map(
    m => encode(m.content.replace(/<\|endoftext\|>/g, '')).length
  )
  return raw.reduce((a, c) => a + c)
}
