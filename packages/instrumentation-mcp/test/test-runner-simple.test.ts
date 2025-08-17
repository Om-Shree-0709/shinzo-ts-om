import { ElicitationManager, globalElicitationState } from "../src/elicitation"
import { TelemetryManager } from "../src/telemetry"
import { TelemetryConfig, ConsentPreferences, ConsentStatus, ElicitationConfig } from "../src/types"
import { ConfigValidator, DEFAULT_CONFIG } from "../src/config"
import { PIISanitizer } from "../src/sanitizer"

describe("Comprehensive Test Suite", () => {
  describe("Elicitation Tests", () => {
    let manager: ElicitationManager

    beforeEach(() => {
      manager = new ElicitationManager()
      globalElicitationState.clearConsentStatus()
      globalElicitationState.initialize({
        enabled: false,
        mode: 'disabled',
        fallbackBehavior: 'use-defaults'
      })
    })

    it("should manage sessions correctly", () => {
      manager.startSession("test-session")
      const session = manager.getSession("test-session")
      expect(session).toBeDefined()
      expect(session?.sessionId).toBe("test-session")
    })

    it("should process consent correctly", async () => {
      const preferences: ConsentPreferences = {
        enableTracing: true,
        enableMetrics: false,
        enableArgumentCollection: true,
        enablePIISanitization: true,
        samplingRate: 0.5
      }

      await manager.processConsent(preferences)
      
      const consentStatus = globalElicitationState.getConsentStatus()
      expect(consentStatus?.preferences).toEqual(preferences)
      expect(consentStatus?.isValid).toBe(true)
    })

    it("should validate consent expiration", () => {
      globalElicitationState.initialize({
        enabled: true,
        requireReconsentAfter: 1 // 1 day
      })

      const expiredConsent: ConsentStatus = {
        sessionId: "test-session",
        timestamp: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
        preferences: {
          enableTracing: true,
          enableMetrics: true,
          enableArgumentCollection: false,
          enablePIISanitization: true,
          samplingRate: 0.1
        },
        isValid: true
      }

      globalElicitationState.setConsentStatus(expiredConsent)
      expect(globalElicitationState.isConsentValid()).toBe(false)
    })
  })

  describe("Telemetry Tests", () => {
    let telemetryManager: TelemetryManager
    let mockConfig: TelemetryConfig

    beforeEach(() => {
      globalElicitationState.clearConsentStatus()
      globalElicitationState.initialize({
        enabled: false,
        mode: 'disabled',
        fallbackBehavior: 'use-defaults'
      })

      mockConfig = {
        serverName: 'test-service',
        serverVersion: '1.0.0',
        exporterEndpoint: 'http://localhost:4318',
        enableTracing: true,
        enableMetrics: true,
        enablePIISanitization: true,
        samplingRate: 1.0
      }

      telemetryManager = new TelemetryManager(mockConfig)
    })

    it("should initialize with correct configuration", () => {
      expect(telemetryManager).toBeDefined()
      expect(typeof telemetryManager.createSpan).toBe('function')
      expect(typeof telemetryManager.getHistogram).toBe('function')
      expect(typeof telemetryManager.getIncrementCounter).toBe('function')
      expect(typeof telemetryManager.shutdown).toBe('function')
    })

    it("should integrate with elicitation", () => {
      const configWithElicitation: TelemetryConfig = {
        ...mockConfig,
        elicitation: {
          enabled: true,
          mode: 'startup',
          fallbackBehavior: 'allow-basic',
          requireReconsentAfter: 30
        }
      }

      const manager = new TelemetryManager(configWithElicitation)
      
      expect(globalElicitationState.isElicitationEnabled()).toBe(true)
      expect(globalElicitationState.getMode()).toBe('startup')
    })

    it("should get consent status", () => {
      const consentStatus = telemetryManager.getConsentStatus()
      expect(consentStatus).toBeNull()

      const testPreferences: ConsentPreferences = {
        enableTracing: true,
        enableMetrics: false,
        enableArgumentCollection: true,
        enablePIISanitization: true,
        samplingRate: 0.5
      }

      globalElicitationState.setConsentStatus({
        sessionId: 'test-session',
        timestamp: Date.now(),
        preferences: testPreferences,
        isValid: true
      })

      const retrievedStatus = telemetryManager.getConsentStatus()
      expect(retrievedStatus?.preferences).toEqual(testPreferences)
    })

    it("should update consent", async () => {
      const testPreferences: ConsentPreferences = {
        enableTracing: false,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.1
      }

      await telemetryManager.updateConsent(testPreferences)

      const consentStatus = globalElicitationState.getConsentStatus()
      expect(consentStatus?.preferences).toEqual(testPreferences)
      expect(consentStatus?.isValid).toBe(true)
    })
  })

  describe("Configuration Tests", () => {
    it("should validate valid configuration", () => {
      const validConfig: TelemetryConfig = {
        serverName: 'test-service',
        serverVersion: '1.0.0',
        exporterEndpoint: 'http://localhost:4318'
      }

      expect(() => ConfigValidator.validate(validConfig)).not.toThrow()
    })

    it("should throw error for missing exporterEndpoint", () => {
      const invalidConfig = {
        serverName: 'test-service',
        serverVersion: '1.0.0'
      } as TelemetryConfig

      expect(() => ConfigValidator.validate(invalidConfig)).toThrow('exporterEndpoint is required')
    })

    it("should have correct default configuration", () => {
      expect(DEFAULT_CONFIG.samplingRate).toBe(1.0)
      expect(DEFAULT_CONFIG.enablePIISanitization).toBe(true)
      expect(DEFAULT_CONFIG.exporterType).toBe('otlp-http')
      expect(DEFAULT_CONFIG.enableMetrics).toBe(true)
      expect(DEFAULT_CONFIG.enableTracing).toBe(true)
    })
  })

  describe("PII Sanitization Tests", () => {
    let sanitizer: PIISanitizer

    beforeEach(() => {
      sanitizer = new PIISanitizer()
    })

    it("should sanitize credit card numbers", () => {
      const data = {
        cardNumber: '4111111111111111',
        name: 'John Doe'
      }

      const sanitized = sanitizer.sanitize(data)
      expect(sanitized.cardNumber).toBe('[REDACTED]')
      expect(sanitized.name).toBe('John Doe')
    })

    it("should sanitize email addresses", () => {
      const data = {
        email: 'test@example.com',
        message: 'Hello world'
      }

      const sanitized = sanitizer.sanitize(data)
      expect(sanitized.email).toBe('[REDACTED]')
      expect(sanitized.message).toBe('Hello world')
    })

    it("should sanitize nested objects", () => {
      const data = {
        user: {
          email: 'user@example.com',
          name: 'John Doe',
          settings: {
            apiKey: 'secret-key-123'
          }
        }
      }

      const sanitized = sanitizer.sanitize(data)
      expect(sanitized.user.email).toBe('[REDACTED]')
      expect(sanitized.user.name).toBe('John Doe')
      expect(sanitized.user.settings.apiKey).toBe('[REDACTED]')
    })
  })
})
