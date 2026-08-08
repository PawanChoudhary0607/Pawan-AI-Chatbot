import { describe, expect, it } from 'vitest'
import { extractArtifactsFromConversation } from '@/artifacts/extractArtifacts'
import type { Conversation } from '@/types/conversation'
import type { ChatMessage } from '@/types/provider'

function makeConversation(messages: ChatMessage[]): Conversation {
  const now = Date.now()
  return {
    id: 'conv-1',
    title: 'Test',
    providerId: 'openrouter',
    model: 'test-model',
    temperature: 0.7,
    topP: 1,
    pinned: false,
    archived: false,
    lastOpenedAt: now,
    messages,
    createdAt: now,
    updatedAt: now,
  }
}

function assistantMessage(content: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    status: 'complete',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('extractArtifactsFromConversation', () => {
  it('extracts a fenced code block as a code artifact with its language', () => {
    const conversation = makeConversation([
      assistantMessage('Here you go:\n\n```python\nprint("hi")\n```\n'),
    ])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]).toMatchObject({ kind: 'code', language: 'python' })
    expect(artifacts[0].content).toBe('print("hi")')
  })

  it('classifies a ```json fenced block as a json artifact, not code', () => {
    const conversation = makeConversation([assistantMessage('```json\n{"a": 1}\n```')])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].kind).toBe('json')
  })

  it('classifies a fenced block with no language tag as json if it parses as JSON', () => {
    const conversation = makeConversation([assistantMessage('```\n{"a": 1, "b": [1,2,3]}\n```')])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts[0].kind).toBe('json')
  })

  it('extracts a GFM pipe table as a table artifact', () => {
    const table = '| Name | Age |\n| --- | --- |\n| Ada | 30 |\n| Grace | 40 |\n'
    const conversation = makeConversation([assistantMessage(`Here is the data:\n\n${table}`)])
    const artifacts = extractArtifactsFromConversation(conversation)
    const tableArtifact = artifacts.find((a) => a.kind === 'table')
    expect(tableArtifact).toBeDefined()
    expect(tableArtifact?.content).toContain('Ada')
  })

  it('treats a long plain-markdown message (no code fence) as a document artifact', () => {
    const longText = 'A'.repeat(500)
    const conversation = makeConversation([assistantMessage(longText)])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts).toHaveLength(1)
    expect(artifacts[0].kind).toBe('markdown')
  })

  it('does not create a document artifact for a short reply', () => {
    const conversation = makeConversation([assistantMessage('Sure, happy to help!')])
    expect(extractArtifactsFromConversation(conversation)).toEqual([])
  })

  it('includes message attachments as attachment-kind artifacts', () => {
    const conversation = makeConversation([
      assistantMessage('See attached', {
        attachments: [
          {
            id: 'a1',
            kind: 'image',
            name: 'chart.png',
            mimeType: 'image/png',
            data: 'xyz',
            sizeBytes: 10,
          },
        ],
      }),
    ])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts.some((a) => a.kind === 'attachment' && a.title === 'chart.png')).toBe(true)
  })

  it('ignores user messages entirely, even if they contain code fences', () => {
    const conversation = makeConversation([
      {
        id: 'u1',
        role: 'user',
        content: '```js\nconsole.log(1)\n```',
        status: 'complete',
        createdAt: Date.now(),
      },
    ])
    expect(extractArtifactsFromConversation(conversation)).toEqual([])
  })

  it('every artifact is linked back to its originating conversation and message', () => {
    const message = assistantMessage('```js\nconsole.log(1)\n```')
    const conversation = makeConversation([message])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts[0].conversationId).toBe(conversation.id)
    expect(artifacts[0].messageId).toBe(message.id)
  })

  it('extracts multiple artifacts from a single message', () => {
    const content = ['```js\nconsole.log(1)\n```', '', '```json\n{"x": 1}\n```'].join('\n')
    const conversation = makeConversation([assistantMessage(content)])
    const artifacts = extractArtifactsFromConversation(conversation)
    expect(artifacts.map((a) => a.kind).sort()).toEqual(['code', 'json'])
  })

  it('skips an empty code fence', () => {
    const conversation = makeConversation([assistantMessage('```js\n\n```')])
    expect(extractArtifactsFromConversation(conversation)).toEqual([])
  })
})
