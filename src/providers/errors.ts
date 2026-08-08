export type ProviderErrorCode =
  | 'invalid_api_key'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'network_error'
  | 'stream_interrupted'
  | 'unsupported_model'
  | 'unknown'

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly providerId: string
  readonly retryable: boolean

  constructor(params: {
    code: ProviderErrorCode
    message: string
    providerId: string
    retryable?: boolean
  }) {
    super(params.message)
    this.name = 'ProviderError'
    this.code = params.code
    this.providerId = params.providerId
    this.retryable = params.retryable ?? false
  }
}

/** Maps an HTTP status from any OpenAI-compatible API to a normalized code.
 * Deliberately conservative: providers don't agree on exact status usage
 * (e.g. some use 429 for both rate limiting and quota), so this covers the
 * common cases without over-claiming precision. */
export function classifyHttpStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return 'invalid_api_key'
  if (status === 402) return 'quota_exceeded'
  if (status === 404) return 'unsupported_model'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'network_error'
  return 'unknown'
}

export function friendlyMessage(code: ProviderErrorCode): string {
  switch (code) {
    case 'invalid_api_key':
      return 'Your API key was rejected. Check that it is correct and has not expired.'
    case 'quota_exceeded':
      return 'This account has run out of quota or credits with this provider.'
    case 'rate_limited':
      return 'You are being rate-limited by the provider. Wait a moment and try again.'
    case 'network_error':
      return 'A network error occurred while contacting the provider.'
    case 'stream_interrupted':
      return 'The response was interrupted before it finished.'
    case 'unsupported_model':
      return 'The selected model is not available from this provider.'
    default:
      return 'An unexpected error occurred.'
  }
}
