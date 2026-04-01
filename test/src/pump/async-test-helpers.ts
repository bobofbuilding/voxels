// ABOUTME: Simplified async test helpers for pump operations
// ABOUTME: Provides utilities for testing async worker behavior without complex timing

import type { FeaturePump } from '../../../src/pump/feature-pump'
import { PumpStatsReader } from '../../../src/pump/pump-stats'

// Global stats reader instance for tests
const statsReader = new PumpStatsReader()

/**
 * Helper function for tests to get pump stats
 */
export function getPumpStats(pump: FeaturePump) {
  return statsReader.readStats(pump)
}

/**
 * Helper function to get parcel status by ID from pump stats
 */
export function getParcelStatus(pump: FeaturePump, parcelId: number): { id: number; pending: number; loading: number; loaded: number; errored: number; timedOut: number; state: string } | undefined {
  const stats = statsReader.readStats(pump)
  return stats.parcelStatuses?.get(parcelId)
}

/**
 * Pumps until all work is complete or timeout is reached
 * Handles both work queue and async worker operations
 */
export async function pumpUntilComplete(pump: FeaturePump, timeoutMs = 5000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const stats = statsReader.readStats(pump)

    // Check if there's any work to do
    const hasWork = stats.workQueueSize > 0
    const hasDeactivations = stats.deactivationQueueSize > 0
    const hasBusyOperations = !!stats.currentBusyOperation

    if (hasWork || hasDeactivations || hasBusyOperations) {
      await pump.pump()
      await new Promise((resolve) => setTimeout(resolve, 1))
    } else {
      // No work detected, we're done
      return
    }
  }

  throw new Error(`Pump operations did not complete within ${timeoutMs}ms`)
}
