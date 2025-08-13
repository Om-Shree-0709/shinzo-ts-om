export interface UserFeedback {
    question: string;
    answer: string;
    timestamp: number;
  }
  
  export interface ElicitationSession {
    sessionId: string;
    feedbacks: UserFeedback[];
    createdAt: number;
  }
  
  export class ElicitationManager {
    private sessions: Map<string, ElicitationSession> = new Map();
  
    startSession(sessionId: string): void {
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          sessionId,
          feedbacks: [],
          createdAt: Date.now(),
        });
      }
    }
  
    recordFeedback(sessionId: string, question: string, answer: string): void {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      session.feedbacks.push({ question, answer, timestamp: Date.now() });
    }
  
    getSession(sessionId: string): ElicitationSession | undefined {
      return this.sessions.get(sessionId);
    }
  
    endSession(sessionId: string): void {
      this.sessions.delete(sessionId);
    }
  }
  