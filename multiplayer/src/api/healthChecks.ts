export type HealthcheckRef = {
  name: string
  status: 'healthy' | 'unhealthy'
}

export type HealthChecks = ReadonlyArray<HealthcheckRef>
