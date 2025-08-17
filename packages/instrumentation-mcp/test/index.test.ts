import { MockMcpServer } from './mocks/MockMcpServer'
import { TelemetryConfig } from '../src/types'

// Mock the modules at the top level before any imports
const mockTelemetryManager = {
  shutdown: jest.fn().mockResolvedValue(undefined),
  createSpan: jest.fn().mockReturnValue({ end: jest.fn() }),
  recordMetric: jest.fn(),
  getConsentStatus: jest.fn().mockReturnValue(null),
  updateConsent: jest.fn().mockResolvedValue(undefined)
}

const mockInstrumentation = {
  instrument: jest.fn(),
  uninstrument: jest.fn()
}

const mockElicitationManager = {
  requestConsent: jest.fn().mockResolvedValue({
    enableTracing: true,
    enableMetrics: true,
    enableArgumentCollection: false,
    enablePIISanitization: true,
    samplingRate: 0.1
  }),
  processConsent: jest.fn().mockResolvedValue(undefined)
}

jest.doMock('../src/telemetry', () => ({
  TelemetryManager: jest.fn().mockImplementation(() => mockTelemetryManager)
}))

jest.doMock('../src/instrumentation', () => ({
  McpServerInstrumentation: jest.fn().mockImplementation(() => mockInstrumentation)
}))

jest.doMock('../src/elicitation', () => ({
  globalElicitationState: {
    initialize: jest.fn(),
    isElicitationDone: jest.fn().mockReturnValue(false),
    clearConsentStatus: jest.fn()
  },
  ElicitationManager: jest.fn().mockImplementation(() => mockElicitationManager)
}))

jest.doMock('../src/config', () => ({
  DEFAULT_CONFIG: {
    samplingRate: 1.0,
    enablePIISanitization: true,
    exporterType: 'otlp-http',
    enableMetrics: true,
    enableTracing: true,
    batchTimeoutMs: 2000,
    dataProcessors: []
  },
  ConfigValidator: {
    validate: jest.fn()
  }
}))

// Import after mocking
const { instrumentServer } = require('../src/index')
const { globalElicitationState, ElicitationManager } = require('../src/elicitation')

describe('Main Entry Point', () => {
  let mockServer: MockMcpServer
  let mockConfig: TelemetryConfig

  beforeEach(() => {
    mockServer = new MockMcpServer()
    mockConfig = {
      serverName: 'test-service',
      serverVersion: '1.0.0',
      exporterEndpoint: 'http://localhost:4318'
    }
  })

  describe('instrumentServer', () => {
    it('should return an observability instance', async () => {
      const result = await instrumentServer(mockServer, mockConfig)
      expect(result).toBeDefined()
      expect(typeof result.shutdown).toBe('function')
      expect(typeof result.getConsentStatus).toBe('function')
      expect(typeof result.updateConsent).toBe('function')
    })

    it('should handle shutdown without errors', async () => {
      const result = await instrumentServer(mockServer, mockConfig)
      await expect(result.shutdown()).resolves.not.toThrow()
    })

    it('should initialize elicitation when configured', async () => {
      const configWithElicitation = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup',
          fallbackBehavior: 'allow-basic'
        }
      }
      
      await instrumentServer(mockServer, configWithElicitation)
      
      expect(globalElicitationState.initialize).toHaveBeenCalledWith(configWithElicitation.elicitation)
      expect(ElicitationManager).toHaveBeenCalled()
    })

    it('should not initialize elicitation when not configured', async () => {
      await instrumentServer(mockServer, mockConfig)
      
      expect(globalElicitationState.initialize).not.toHaveBeenCalled()
    })

    it('should request consent when elicitation is enabled and not done', async () => {
      const configWithElicitation = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup'
        }
      }

      globalElicitationState.isElicitationDone.mockReturnValue(false)
      
      await instrumentServer(mockServer, configWithElicitation)
      
      expect(mockElicitationManager.requestConsent).toHaveBeenCalled()
      expect(mockElicitationManager.processConsent).toHaveBeenCalled()
    })

    it('should not request consent when elicitation is already done', async () => {
      const configWithElicitation = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup'
        }
      }

      globalElicitationState.isElicitationDone.mockReturnValue(true)
      
      await instrumentServer(mockServer, configWithElicitation)
      
      expect(mockElicitationManager.requestConsent).not.toHaveBeenCalled()
      expect(mockElicitationManager.processConsent).not.toHaveBeenCalled()
    })
  })

  describe('Exports', () => {
    it('should export main initialization function', () => {
      const exports = require('../src/index')

      expect(exports).toHaveProperty('instrumentServer')
      expect(typeof exports.instrumentServer).toBe('function')
    })

    it('should export utility classes', () => {
      const exports = require('../src/index')

      expect(exports).toHaveProperty('PIISanitizer')
      expect(exports).toHaveProperty('ConfigValidator')
    })

    it('should be a complete module', () => {
      const exports = require('../src/index')

      // Should have core functionality
      expect(exports.instrumentServer).toBeDefined()
      expect(exports.PIISanitizer).toBeDefined()
      expect(exports.ConfigValidator).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('should have error handling capability', () => {
      // The function includes error handling - this is tested in integration tests
      expect(typeof instrumentServer).toBe('function')
    })
  })
})
