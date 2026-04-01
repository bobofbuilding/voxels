import prom from 'prom-client'

export function createPromRegistry(
  appName: string,
  instanceId: string,
  extraDefaultLabels: Record<string, string | number> = {},
): prom.Registry {
  const registry = new prom.Registry()

  registry.setDefaultLabels({
    app_name: appName,
    instance_id: instanceId,
    ...extraDefaultLabels,
  })

  prom.collectDefaultMetrics({ register: registry })

  return registry
}
