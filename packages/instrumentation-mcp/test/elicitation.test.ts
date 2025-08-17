import { ElicitationManager, globalElicitationState, UserFeedback, ElicitationSession } from "../src/elicitation"
import { ConsentPreferences, ConsentStatus, ElicitationConfig } from "../src/types"

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

describe("ElicitationManager", () => {
  let manager: ElicitationManager

  beforeEach(() => {
    manager = new ElicitationManager()
    // Reset global state before each test
    globalElicitationState.clearConsentStatus()
    jest.clearAllMocks()
    
    // Reset global state configuration
    globalElicitationState.initialize({
      enabled: false,
      mode: 'disabled',
      fallbackBehavior: 'use-defaults'
    })
    
    // Setup console mock
    mockConsoleLog = jest.fn()
    console.log = mockConsoleLog
  })

  describe("Session Management", () => {
    it("should start a new session", () => {
      manager.startSession("abc123")
      const session = manager.getSession("abc123")
      expect(session).toBeDefined()
      expect(session?.sessionId).toBe("abc123")
      expect(session?.feedbacks).toHaveLength(0)
      expect(session?.createdAt).toBeGreaterThan(0)
    })

    it("should record feedback in a session", () => {
      manager.startSession("abc123")
      manager.recordFeedback("abc123", "What is your name?", "Om Shree")
      const session = manager.getSession("abc123")
      expect(session?.feedbacks).toHaveLength(1)
      expect(session?.feedbacks[0].question).toBe("What is your name?")
      expect(session?.feedbacks[0].answer).toBe("Om Shree")
      expect(session?.feedbacks[0].timestamp).toBeGreaterThan(0)
    })

    it("should return undefined for unknown session", () => {
      const session = manager.getSession("nope")
      expect(session).toBeUndefined()
    })

    it("should delete session on end", () => {
      manager.startSession("abc123")
      manager.endSession("abc123")
      expect(manager.getSession("abc123")).toBeUndefined()
    })

    it("should throw error when recording feedback in unknown session", () => {
      expect(() =>
        manager.recordFeedback("ghost", "Q?", "A?")
      ).toThrowError("Session ghost not found")
    })

    it("should handle multiple feedback entries in a session", () => {
      manager.startSession("multi123")
      manager.recordFeedback("multi123", "Question 1", "Answer 1")
      manager.recordFeedback("multi123", "Question 2", "Answer 2")
      manager.recordFeedback("multi123", "Question 3", "Answer 3")
      
      const session = manager.getSession("multi123")
      expect(session?.feedbacks).toHaveLength(3)
      expect(session?.feedbacks[0].question).toBe("Question 1")
      expect(session?.feedbacks[1].question).toBe("Question 2")
      expect(session?.feedbacks[2].question).toBe("Question 3")
    })
  })

  describe("Consent Management", () => {
    it("should request consent and return default preferences", async () => {
      const preferences = await manager.requestConsent()
      
      expect(preferences).toBeDefined()
      expect(preferences).toEqual({
        enableTracing: true,
        enableMetrics: true,
        enableArgumentCollection: false,
        enablePIISanitization: true,
        samplingRate: 0.1
      })
      expect(mockConsoleLog).toHaveBeenCalledWith('Elicitation: Consent request would be shown here in future UI implementation')
    })

    it("should process consent and update global state", async () => {
      const testPreferences: ConsentPreferences = {
        enableTracing: false,
        enableMetrics: true,
        enableArgumentCollection: true,
        enablePIISanitization: false,
        samplingRate: 0.5
      }

      await manager.processConsent(testPreferences)
      
      const consentStatus = globalElicitationState.getConsentStatus()
      expect(consentStatus).toBeDefined()
      expect(consentStatus?.preferences).toEqual(testPreferences)
      expect(consentStatus?.isValid).toBe(true)
      expect(consentStatus?.sessionId).toBeDefined()
      expect(consentStatus?.timestamp).toBeGreaterThan(0)
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
  })
})

describe("GlobalElicitationState", () => {
  beforeEach(() => {
    globalElicitationState.clearConsentStatus()
    jest.clearAllMocks()
  })

  describe("Initialization", () => {
    it("should initialize with config", () => {
      const config: ElicitationConfig = {
        enabled: true,
        mode: 'startup',
        fallbackBehavior: 'allow-basic',
        requireReconsentAfter: 30
      }

      globalElicitationState.initialize(config)
      
      expect(globalElicitationState.isElicitationEnabled()).toBe(true)
      expect(globalElicitationState.getMode()).toBe('startup')
      expect(globalElicitationState.getFallbackBehavior()).toBe('allow-basic')
    })

    it("should use default values when config is incomplete", () => {
      const config: ElicitationConfig = {
        enabled: true
      }

      globalElicitationState.initialize(config)
      
      expect(globalElicitationState.isElicitationEnabled()).toBe(true)
      expect(globalElicitationState.getMode()).toBe('disabled')
      expect(globalElicitationState.getFallbackBehavior()).toBe('use-defaults')
    })
  })

  describe("Consent Status Management", () => {
    it("should start with no consent status", () => {
      expect(globalElicitationState.getConsentStatus()).toBeNull()
      expect(globalElicitationState.isElicitationDone()).toBe(false)
    })

    it("should set and get consent status", () => {
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
      
      const retrieved = globalElicitationState.getConsentStatus()
      expect(retrieved).toEqual(consentStatus)
      expect(globalElicitationState.isElicitationDone()).toBe(true)
    })

    it("should clear consent status", () => {
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
      expect(globalElicitationState.getConsentStatus()).toBeDefined()
      
      globalElicitationState.clearConsentStatus()
      expect(globalElicitationState.getConsentStatus()).toBeNull()
      expect(globalElicitationState.isElicitationDone()).toBe(false)
    })
  })

  describe("Consent Validation", () => {
    it("should validate consent without expiration", () => {
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
      expect(globalElicitationState.isConsentValid()).toBe(true)
    })

    it("should validate consent with expiration", () => {
      const config: ElicitationConfig = {
        enabled: true,
        requireReconsentAfter: 1 // 1 day
      }
      globalElicitationState.initialize(config)

      const consentStatus: ConsentStatus = {
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

      globalElicitationState.setConsentStatus(consentStatus)
      expect(globalElicitationState.isConsentValid()).toBe(false)
    })

    it("should validate recent consent with expiration", () => {
      const config: ElicitationConfig = {
        enabled: true,
        requireReconsentAfter: 30 // 30 days
      }
      globalElicitationState.initialize(config)

      const consentStatus: ConsentStatus = {
        sessionId: "test-session",
        timestamp: Date.now() - (15 * 24 * 60 * 60 * 1000), // 15 days ago
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
      expect(globalElicitationState.isConsentValid()).toBe(true)
    })

    it("should return false for invalid consent", () => {
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
        isValid: false
      }

      globalElicitationState.setConsentStatus(consentStatus)
      expect(globalElicitationState.isElicitationDone()).toBe(false)
    })
  })

  describe("Configuration Getters", () => {
    it("should get elicitation enabled status", () => {
      // Reset to default state first
      globalElicitationState.clearConsentStatus()
      globalElicitationState.initialize({
        enabled: false,
        mode: 'disabled',
        fallbackBehavior: 'use-defaults'
      })
      
      expect(globalElicitationState.isElicitationEnabled()).toBe(false)
      
      globalElicitationState.initialize({ enabled: true })
      expect(globalElicitationState.isElicitationEnabled()).toBe(true)
    })

    it("should get elicitation mode", () => {
      expect(globalElicitationState.getMode()).toBe('disabled')
      
      globalElicitationState.initialize({ mode: 'startup' })
      expect(globalElicitationState.getMode()).toBe('startup')
    })

    it("should get fallback behavior", () => {
      expect(globalElicitationState.getFallbackBehavior()).toBe('use-defaults')
      
      globalElicitationState.initialize({ fallbackBehavior: 'deny-all' })
      expect(globalElicitationState.getFallbackBehavior()).toBe('deny-all')
    })
  })

  describe("Singleton Pattern", () => {
    it("should maintain singleton instance", () => {
      const instance1 = globalElicitationState
      const instance2 = globalElicitationState
      
      expect(instance1).toBe(instance2)
    })

    it("should maintain state across references", () => {
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
      
      // Get a new reference to the same instance
      const { globalElicitationState: newReference } = require("../src/elicitation")
      expect(newReference.getConsentStatus()).toEqual(consentStatus)
    })
  })
})
