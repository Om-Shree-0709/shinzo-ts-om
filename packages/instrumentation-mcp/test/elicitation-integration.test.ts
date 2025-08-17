import { instrumentServer } from '../src/index'
import { TelemetryConfig } from '../src/types'
import { globalElicitationState } from '../src/elicitation'
import { MockMcpServer } from './mocks/MockMcpServer'

// Mock console.log to capture output
let mockConsoleLog: jest.Mock

beforeEach(() => {
  mockConsoleLog = jest.fn()
  console.log = mockConsoleLog
})

afterEach(() => {
  // Restore original console.log
  console.log = jest.requireActual('console').log
})

describe('Elicitation Integration Tests', () => {
  let mockServer: MockMcpServer
  let mockConfig: TelemetryConfig

  beforeEach(() => {
    mockServer = new MockMcpServer()
    mockConfig = {
      serverName: 'test-service',
      serverVersion: '1.0.0',
      exporterEndpoint: 'http://localhost:4318',
      enableTracing: true,
      enableMetrics: true,
      enablePIISanitization: true,
      samplingRate: 1.0
    }
    
    // Reset global state
    globalElicitationState.clearConsentStatus()
    
    // Reset global state configuration
    globalElicitationState.initialize({
      enabled: false,
      mode: 'disabled',
      fallbackBehavior: 'use-defaults'
    })
  })

  describe('instrumentServer with elicitation', () => {
    it('should initialize with elicitation configuration', async () => {
      const configWithElicitation: TelemetryConfig = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup',
          fallbackBehavior: 'allow-basic',
          requireReconsentAfter: 30
        }
      }

      const telemetry = await instrumentServer(mockServer, configWithElicitation)
      
      expect(telemetry).toBeDefined()
      expect(typeof telemetry.getConsentStatus).toBe('function')
      expect(typeof telemetry.updateConsent).toBe('function')
      expect(globalElicitationState.isElicitationEnabled()).toBe(true)
    })

    it('should not initialize elicitation when not configured', async () => {
      const telemetry = await instrumentServer(mockServer, mockConfig)
      
      expect(telemetry).toBeDefined()
      expect(globalElicitationState.isElicitationEnabled()).toBe(false)
    })

    it('should provide consent status methods', async () => {
      const telemetry = await instrumentServer(mockServer, mockConfig)
      
      const consentStatus = telemetry.getConsentStatus()
      expect(consentStatus).toBeNull()
    })

    it('should allow updating consent preferences', async () => {
      const telemetry = await instrumentServer(mockServer, mockConfig)
      
      const testPreferences = {
        enableTracing: false,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.5
      }

      await telemetry.updateConsent(testPreferences)
      
      const consentStatus = telemetry.getConsentStatus()
      expect(consentStatus).toBeDefined()
      expect(consentStatus?.preferences).toEqual(testPreferences)
    })
  })

  describe('elicitation flow', () => {
    it('should handle elicitation when enabled and not done', async () => {
      const configWithElicitation: TelemetryConfig = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup'
        }
      }

             const telemetry = await instrumentServer(mockServer, configWithElicitation)
       
       expect(mockConsoleLog).toHaveBeenCalledWith('Elicitation: Requesting user consent for telemetry...')
       expect(telemetry.getConsentStatus()).toBeDefined()
    })

    it('should not request consent when already done', async () => {
      // Set consent status first
      const testPreferences = {
        enableTracing: true,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.1
      }

      globalElicitationState.setConsentStatus({
        sessionId: 'test-session',
        timestamp: Date.now(),
        preferences: testPreferences,
        isValid: true
      })

      const configWithElicitation: TelemetryConfig = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup'
        }
      }

             const telemetry = await instrumentServer(mockServer, configWithElicitation)
       
       expect(mockConsoleLog).not.toHaveBeenCalledWith('Elicitation: Requesting user consent for telemetry...')
       expect(telemetry.getConsentStatus()).toBeDefined()
    })
  })

  describe('consent validation', () => {
    it('should validate consent expiration', async () => {
      const configWithElicitation: TelemetryConfig = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          requireReconsentAfter: 1 // 1 day
        }
      }

      // Set expired consent
      const expiredPreferences = {
        enableTracing: true,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.1
      }

      globalElicitationState.setConsentStatus({
        sessionId: 'test-session',
        timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
        preferences: expiredPreferences,
        isValid: true
      })

      const telemetry = await instrumentServer(mockServer, configWithElicitation)
      
      expect(globalElicitationState.isConsentValid()).toBe(false)
    })

    it('should validate recent consent', async () => {
      const configWithElicitation: TelemetryConfig = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          requireReconsentAfter: 30 // 30 days
        }
      }

      // Set recent consent
      const recentPreferences = {
        enableTracing: true,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.1
      }

      globalElicitationState.setConsentStatus({
        sessionId: 'test-session',
        timestamp: Date.now() - (15 * 24 * 60 * 60 * 1000), // 15 days ago
        preferences: recentPreferences,
        isValid: true
      })

      const telemetry = await instrumentServer(mockServer, configWithElicitation)
      
      expect(globalElicitationState.isConsentValid()).toBe(true)
    })
  })
})
