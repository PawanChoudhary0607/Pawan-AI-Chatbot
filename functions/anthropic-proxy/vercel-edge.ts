import { handleAnthropicProxyRequest } from './handler'

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  return handleAnthropicProxyRequest(request, {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  })
}
