/**
 * Provider abstraction.
 *
 * Every AI provider (cloud or local) implements ChatProvider. The UI, state
 * layer, and persistence layer NEVER branch on a provider id/name — they only
 * ever read `capabilities` flags off ProviderMeta and call the shared
 * interface methods below. Adding a new provider = write one adapter file +
 * register it. No UI changes required.
 */

/** Capability flags a provider may support. Unlisted/false = UI hides that control. */
export interface ProviderCapabilities {
  streaming: boolean
  vision: boolean
  documentInput: boolean
  toolCalling: boolean
  structuredOutput: boolean
  reasoning: boolean
  webSearch: boolean
  mcp: boolean
  /** Reserved for future use — no UI surface yet. */
  embeddings: boolean
  /** Reserved for future use — no UI surface yet. */
  imageGeneration: boolean
}

/** Optional numeric/enum limits tied to specific capabilities. */
export interface ProviderLimits {
  // Existing fields (Milestone 1) — untouched.
  maxImageSizeMB?: number
  maxDocumentSizeMB?: number
  maxToolsPerRequest?: number
  reasoningEffortLevels?: string[]
  maxOutputTokens?: number

  // Milestone 5 additions. Generic across every provider — nothing here
  // may reference a specific provider by name or branch on provider id.
  /** Model/provider context window, in tokens, when known. */
  maxContextTokens?: number
  /** How many attachments a single request may include. */
  maxAttachments?: number
  /** Max size (bytes) for a single image attachment. */
  maxImageSize?: number
  /** MIME types (exact or 'type/*' wildcard) this provider will accept as
   * attachments — independent of the app-wide attachment validation rules
   * in src/attachments/validation.ts, which apply before this is ever
   * consulted. */
  supportedMimeTypes?: string[]

  // Boolean mirrors of ProviderCapabilities, derived (never hand-set) via
  // deriveLimitsFromCapabilities() so this can never drift out of sync with
  // meta.capabilities — kept as their own fields here only because callers
  // that already have `limits` in hand (e.g. a cost/context estimator)
  // shouldn't need a second object just to read a capability flag.
  supportsStreaming?: boolean
  supportsVision?: boolean
  supportsReasoning?: boolean
  supportsJSON?: boolean
  supportsToolCalling?: boolean
  supportsMCP?: boolean
}

export type CredentialField =
  | { key: string; label: string; type: 'apiKey'; placeholder?: string; helpUrl?: string }
  | { key: string; label: string; type: 'baseUrl'; placeholder?: string }

export interface ProviderMeta {
  /** Stable machine key, e.g. "openrouter". Never shown to users as an identity check in the UI. */
  id: string
  name: string
  description?: string
  iconKey?: string
  docsUrl?: string
  /** True for providers reached over localhost (Ollama, LM Studio, generic local servers). */
  isLocal: boolean
  /** False for local providers that need no key (e.g. bare Ollama). */
  requiresKey: boolean
  /** Fields the settings UI should render generically for this provider. */
  credentialFields: CredentialField[]
  capabilities: ProviderCapabilities
  limits?: ProviderLimits
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

/**
 * Lifecycle status of a message. 'streaming'/'pending' let the persistence
 * layer (Milestone 2) and future streaming UI (Milestone 3+) distinguish
 * in-flight messages from settled ones without changing this type again.
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'

export interface Attachment {
  id: string
  kind: 'image' | 'document'
  name: string
  mimeType: string
  /** Base64 or text content depending on kind; adapters decide how to encode for their API. */
  data: string
  sizeBytes: number
}

export interface ToolDefinition {
  name: string
  description: string
  parametersSchema: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  /** Defaults to 'complete' for messages created outside a streaming flow. */
  status?: MessageStatus
  attachments?: Attachment[]
  toolCalls?: ToolCall[]
  /** Populated by providers with capabilities.reasoning === true (Milestone 4+). */
  reasoning?: string
  createdAt: number
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  systemPrompt?: string
  temperature?: number
  topP?: number
  maxTokens?: number

  /** Only meaningful when capabilities.toolCalling is true. */
  tools?: ToolDefinition[]
  /** Only meaningful when capabilities.structuredOutput is true. */
  responseSchema?: Record<string, unknown>
  /** Only meaningful when capabilities.reasoning is true. */
  reasoningEffort?: string
  /** Only meaningful when capabilities.webSearch is true. */
  enableWebSearch?: boolean
  /** Only meaningful when capabilities.mcp is true. */
  mcpServers?: { url: string; name: string }[]

  signal?: AbortSignal
}

export interface ChatResponse {
  content: string
  toolCalls?: ToolCall[]
  structuredData?: unknown
  reasoningTrace?: string
  webSearchResults?: { title: string; url: string; snippet?: string }[]
  usage?: { inputTokens?: number; outputTokens?: number }
}

/** A single streamed delta. */
export interface ChatChunk {
  type: 'text' | 'reasoning' | 'tool_call' | 'done' | 'error'
  textDelta?: string
  reasoningDelta?: string
  toolCall?: ToolCall
  error?: string
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
  /** Per-model capability overrides (e.g. only some OpenAI models support vision). */
  capabilities?: Partial<ProviderCapabilities>
}

export interface ValidationResult {
  valid: boolean
  message?: string
}

export interface ProviderCredentials {
  [fieldKey: string]: string | undefined
}

/**
 * Milestone 5: generic runtime estimates. Both are heuristic by design
 * (character-count-based token approximation, no real tokenizer or pricing
 * table wired up yet) — `isEstimate` is always `true` so the UI can never
 * mistake either for an authoritative, provider-confirmed number. Every
 * provider computes these identically via the shared helpers in
 * src/providers/runtimeCapabilities.ts; no adapter implements its own math.
 */
export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  estimatedInputCost?: number
  estimatedOutputCost?: number
  currency?: string
  isEstimate: true
}

export interface ContextEstimate {
  usedTokens: number
  maxTokens?: number
  remainingTokens?: number
  isEstimate: true
}

/**
 * The contract every adapter implements. The UI, stores, and event system
 * only ever program against this interface plus ProviderMeta capabilities.
 */
export interface ChatProvider {
  meta: ProviderMeta

  validateKey(credentials: ProviderCredentials): Promise<ValidationResult>
  listModels(credentials: ProviderCredentials): Promise<ModelInfo[]>
  sendMessage(request: ChatRequest, credentials: ProviderCredentials): Promise<ChatResponse>
  streamMessage(request: ChatRequest, credentials: ProviderCredentials): AsyncIterable<ChatChunk>

  /** Rough, provider-agnostic cost estimate for a given request. */
  estimateCost(request: ChatRequest): CostEstimate
  /** Rough context-window usage estimate for a given request. `model` is
   * optional — when supplied, its `contextWindow` takes priority over
   * `meta.limits.maxContextTokens` for the ceiling. */
  estimateContext(request: ChatRequest, model?: ModelInfo): ContextEstimate
  /** Generic capability check — reads meta.capabilities so callers never
   * need a provider-id switch statement to answer "can this provider do X". */
  supportsCapability(capability: keyof ProviderCapabilities): boolean
}
