import { TelemetryManager } from './telemetry'
import { McpServerInstrumentation } from './instrumentation'
import { TelemetryConfig, ObservabilityInstance } from './types'
import { MetricOptions, Span } from '@opentelemetry/api'
import { globalElicitationState, ElicitationManager } from './elicitation'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp'

export async function instrumentServer(
  server: McpServer,
  config: TelemetryConfig
): Promise<ObservabilityInstance> {
  // Initialize elicitation if configured
  if (config.elicitation?.enabled) {
    const elicitationManager = new ElicitationManager()
    
    // Check if elicitation is already done
    if (!globalElicitationState.isElicitationDone()) {
      console.log('Elicitation: Requesting user consent for telemetry...')
      const preferences = await elicitationManager.requestConsent()
      if (preferences) {
        await elicitationManager.processConsent(preferences)
      }
    }
  }

  const telemetryManager = new TelemetryManager(config)
  const instrumentation = new McpServerInstrumentation(server, telemetryManager)
  instrumentation.instrument()

  return {
    startActiveSpan: (name: string, attributes: Record<string, any>, fn: (span: Span) => void) => {
      return telemetryManager.startActiveSpan(name, attributes, fn)
    },
    getHistogram: (name: string, options: MetricOptions) => {
      return telemetryManager.getHistogram(name, options)
    },
    getIncrementCounter: (name: string, options: MetricOptions) => {
      return telemetryManager.getIncrementCounter(name, options)
    },
    processTelemetryAttributes: (data: any) => {
      return telemetryManager.processTelemetryAttributes(data)
    },
    shutdown: async () => {
      await telemetryManager.shutdown()
    },
    getConsentStatus: () => {
      return telemetryManager.getConsentStatus()
    },
    updateConsent: async (preferences: any) => {
      await telemetryManager.updateConsent(preferences)
    }
  }
}

export { TelemetryManager } from './telemetry'
export { PIISanitizer } from './sanitizer'
export { ConfigValidator } from './config'

export type {
  AuthConfig,
  ObservabilityInstance,
  TelemetryConfig,
} from './types'

export type { UserFeedback, ElicitationSession } from './elicitation'
