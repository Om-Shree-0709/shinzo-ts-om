import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { instrumentServer, TelemetryConfig } from "../src/index"

const NAME = "my-mcp-server-with-elicitation"
const VERSION = "1.0.0"

// Create MCP server
const server = new McpServer({
  name: NAME,
  version: VERSION,
  description: "Example MCP server with telemetry elicitation"
})

// Configure telemetry with elicitation
const telemetryConfig: TelemetryConfig = {
  serverName: NAME,
  serverVersion: VERSION,
  exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1",
  exporterAuth: process.env.OTEL_AUTH_TOKEN ? {
    type: "bearer",
    token: process.env.OTEL_AUTH_TOKEN
  } : undefined,
  samplingRate: parseFloat(process.env.OTEL_SAMPLING_RATE || "1.0"),
  enableArgumentCollection: true,
  
  // Elicitation configuration
  elicitation: {
    enabled: true,
    mode: 'startup', // Request consent on startup
    fallbackBehavior: 'allow-basic', // If elicitation fails, allow basic telemetry
    requireReconsentAfter: 30 // Require re-consent after 30 days
  }
}

// Add tools using the tool method
server.tool("check_consent",
  "Check the current telemetry consent status",
  {},
  async () => {
    return {
      content: [
        {
          type: "text",
          text: "This tool demonstrates consent checking functionality"
        }
      ]
    }
  }
)

server.tool("update_consent",
  "Update telemetry consent preferences",
  {
    enableTracing: z.boolean().describe("Enable request tracing"),
    enableMetrics: z.boolean().describe("Enable performance metrics"),
    enableArgumentCollection: z.boolean().describe("Enable argument collection"),
    samplingRate: z.number().min(0).max(1).describe("Sampling rate (0-1)")
  },
  async (params) => {
    return {
      content: [
        {
          type: "text",
          text: `Consent preferences updated: tracing=${params.enableTracing}, metrics=${params.enableMetrics}, args=${params.enableArgumentCollection}, sampling=${params.samplingRate}`
        }
      ]
    }
  }
)

// Start server
async function main() {
  console.log('Starting MCP server with telemetry elicitation...')
  
  // Initialize telemetry with elicitation
  const telemetry = await instrumentServer(server, telemetryConfig)
  
  // Check consent status
  const consentStatus = telemetry.getConsentStatus()
  if (consentStatus) {
    console.log('Telemetry consent status:', {
      sessionId: consentStatus.sessionId,
      timestamp: new Date(consentStatus.timestamp).toISOString(),
      preferences: consentStatus.preferences,
      isValid: consentStatus.isValid
    })
  } else {
    console.log('No telemetry consent recorded')
  }
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('Shutting down...')
    await telemetry.shutdown()
    process.exit(0)
  })
  
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('MCP server connected and ready')
}

main().catch(console.error)
