import { ConsentStatus, ConsentPreferences, ElicitationConfig } from './types'
import { generateUuid } from './utils'

// Global state for elicitation consent
class GlobalElicitationState {
  private static instance: GlobalElicitationState
  private consentStatus: ConsentStatus | null = null
  private config: ElicitationConfig | null = null
  private isInitialized: boolean = false

  private constructor() {}

  static getInstance(): GlobalElicitationState {
    if (!GlobalElicitationState.instance) {
      GlobalElicitationState.instance = new GlobalElicitationState()
    }
    return GlobalElicitationState.instance
  }

  initialize(config: ElicitationConfig): void {
    this.config = config
    this.isInitialized = true
  }

  isElicitationEnabled(): boolean {
    return this.config?.enabled === true
  }

  isElicitationDone(): boolean {
    return this.consentStatus !== null && this.consentStatus.isValid
  }

  getConsentStatus(): ConsentStatus | null {
    return this.consentStatus
  }

  setConsentStatus(consent: ConsentStatus): void {
    this.consentStatus = consent
  }

  clearConsentStatus(): void {
    this.consentStatus = null
  }

  isConsentValid(): boolean {
    if (!this.consentStatus) return false
    
    if (!this.config?.requireReconsentAfter) return true
    
    const maxAgeMs = this.config.requireReconsentAfter * 24 * 60 * 60 * 1000 // Convert days to ms
    const ageMs = Date.now() - this.consentStatus.timestamp
    
    return ageMs < maxAgeMs
  }

  getFallbackBehavior(): 'deny-all' | 'allow-basic' | 'use-defaults' {
    return this.config?.fallbackBehavior || 'use-defaults'
  }

  getMode(): 'startup' | 'first-request' | 'disabled' {
    return this.config?.mode || 'disabled'
  }
}

// Export the global instance
export const globalElicitationState = GlobalElicitationState.getInstance()

export interface UserFeedback {
  question: string
  answer: string
  timestamp: number
}

export interface ElicitationSession {
  sessionId: string
  feedbacks: UserFeedback[]
  createdAt: number
}

export class ElicitationManager {
  private sessions: Map<string, ElicitationSession> = new Map()

  startSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        feedbacks: [],
        createdAt: Date.now(),
      })
    }
  }

  recordFeedback(sessionId: string, question: string, answer: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    session.feedbacks.push({ question, answer, timestamp: Date.now() })
  }

  getSession(sessionId: string): ElicitationSession | undefined {
    return this.sessions.get(sessionId)
  }

  endSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  // New methods for consent management
  async requestConsent(): Promise<ConsentPreferences | null> {
    // This is a placeholder for future UI implementation
    // For now, we'll use default consent
    console.log('Elicitation: Consent request would be shown here in future UI implementation')
    
    // Return default consent preferences
    return {
      enableTracing: true,
      enableMetrics: true,
      enableArgumentCollection: false,
      enablePIISanitization: true,
      samplingRate: 0.1
    }
  }

  async processConsent(preferences: ConsentPreferences): Promise<void> {
    const consentStatus: ConsentStatus = {
      sessionId: generateUuid(),
      timestamp: Date.now(),
      preferences,
      isValid: true
    }

    globalElicitationState.setConsentStatus(consentStatus)
  }

  getDefaultConsentPreferences(): ConsentPreferences {
    return {
      enableTracing: false,
      enableMetrics: true,
      enableArgumentCollection: false,
      enablePIISanitization: true,
      samplingRate: 0.1
    }
  }

  getDenyAllPreferences(): ConsentPreferences {
    return {
      enableTracing: false,
      enableMetrics: false,
      enableArgumentCollection: false,
      enablePIISanitization: true,
      samplingRate: 0
    }
  }
}
  