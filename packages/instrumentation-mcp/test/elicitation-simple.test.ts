import { ElicitationManager, globalElicitationState } from "../src/elicitation"
import { ConsentPreferences, ConsentStatus, ElicitationConfig } from "../src/types"

describe("Simple Elicitation Tests", () => {
  let manager: ElicitationManager

  beforeEach(() => {
    manager = new ElicitationManager()
    // Reset global state
    globalElicitationState.clearConsentStatus()
    globalElicitationState.initialize({
      enabled: false,
      mode: 'disabled',
      fallbackBehavior: 'use-defaults'
    })
  })

  describe("ElicitationManager", () => {
    it("should create a new instance", () => {
      expect(manager).toBeDefined()
    })

    it("should start and manage sessions", () => {
      manager.startSession("test-session")
      const session = manager.getSession("test-session")
      expect(session).toBeDefined()
      expect(session?.sessionId).toBe("test-session")
    })

    it("should record feedback in sessions", () => {
      manager.startSession("test-session")
      manager.recordFeedback("test-session", "Test question", "Test answer")
      const session = manager.getSession("test-session")
      expect(session?.feedbacks).toHaveLength(1)
      expect(session?.feedbacks[0].question).toBe("Test question")
      expect(session?.feedbacks[0].answer).toBe("Test answer")
    })

    it("should get default consent preferences", () => {
      const preferences = manager.getDefaultConsentPreferences()
      expect(preferences).toEqual({
        enableTracing: false,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.1
      })
    })

    it("should get deny-all consent preferences", () => {
      const preferences = manager.getDenyAllPreferences()
      expect(preferences).toEqual({
        enableTracing: false,
        enableMetrics: false,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0
      })
    })

    it("should process consent and update global state", async () => {
      const testPreferences: ConsentPreferences = {
        enableTracing: true,
        enableMetrics: false,
        enableArgumentCollection: true,
        enablePIISanitization: false,
        samplingRate: 0.5
      }

      await manager.processConsent(testPreferences)
      
      const consentStatus = globalElicitationState.getConsentStatus()
      expect(consentStatus).toBeDefined()
      expect(consentStatus?.preferences).toEqual(testPreferences)
      expect(consentStatus?.isValid).toBe(true)
    })
  })

  describe("GlobalElicitationState", () => {
    it("should initialize with default values", () => {
      expect(globalElicitationState.isElicitationEnabled()).toBe(false)
      expect(globalElicitationState.getMode()).toBe('disabled')
      expect(globalElicitationState.getFallbackBehavior()).toBe('use-defaults')
    })

    it("should initialize with custom config", () => {
      const config: ElicitationConfig = {
        enabled: true,
        mode: 'startup',
        fallbackBehavior: 'deny-all',
        requireReconsentAfter: 30
      }

      globalElicitationState.initialize(config)
      
      expect(globalElicitationState.isElicitationEnabled()).toBe(true)
      expect(globalElicitationState.getMode()).toBe('startup')
      expect(globalElicitationState.getFallbackBehavior()).toBe('deny-all')
    })

    it("should manage consent status", () => {
      expect(globalElicitationState.getConsentStatus()).toBeNull()
      expect(globalElicitationState.isElicitationDone()).toBe(false)

      const consentStatus: ConsentStatus = {
        sessionId: "test-session",
        timestamp: Date.now(),
        preferences: {
          enableTracing: true,
          enableMetrics: true,
          enableArgumentCollection: false,
          enablePIISanitization: true,
          samplingRate: 0.1
        },
        isValid: true
      }

      globalElicitationState.setConsentStatus(consentStatus)
      
      expect(globalElicitationState.getConsentStatus()).toEqual(consentStatus)
      expect(globalElicitationState.isElicitationDone()).toBe(true)
    })

    it("should validate consent expiration", () => {
      const config: ElicitationConfig = {
        enabled: true,
        requireReconsentAfter: 1 // 1 day
      }
      globalElicitationState.initialize(config)

      // Set expired consent
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

      // Set recent consent
      const recentConsent: ConsentStatus = {
        sessionId: "test-session",
        timestamp: Date.now() - (12 * 60 * 60 * 1000), // 12 hours ago
        preferences: {
          enableTracing: true,
          enableMetrics: true,
          enableArgumentCollection: false,
          enablePIISanitization: true,
          samplingRate: 0.1
        },
        isValid: true
      }

      globalElicitationState.setConsentStatus(recentConsent)
      expect(globalElicitationState.isConsentValid()).toBe(true)
    })
  })
})
