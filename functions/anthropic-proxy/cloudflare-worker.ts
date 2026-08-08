import { handleAnthropicProxyRequest, type ProxyEnv } from './handler'

export default {
  async fetch(request: Request, env: ProxyEnv): Promise<Response> {
    return handleAnthropicProxyRequest(request, env)
  },
}
