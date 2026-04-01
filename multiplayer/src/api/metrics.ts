import type { Metrics } from '../createMetrics'

export function createMetricsHandler(metrics: Metrics) {
  return async function (_req: import('http').IncomingMessage, res: import('http').ServerResponse) {
    const summary = await metrics.registry.metrics()
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.end(summary)
  }
}
