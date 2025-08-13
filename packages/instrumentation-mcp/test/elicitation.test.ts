import { ElicitationManager } from "../src/elicitation";

describe("ElicitationManager", () => {
  let manager: ElicitationManager;

  beforeEach(() => {
    manager = new ElicitationManager();
  });

  it("should start a new session", () => {
    manager.startSession("abc123");
    const session = manager.getSession("abc123");
    expect(session).toBeDefined();
    expect(session?.sessionId).toBe("abc123");
    expect(session?.feedbacks).toHaveLength(0);
  });

  it("should record feedback in a session", () => {
    manager.startSession("abc123");
    manager.recordFeedback("abc123", "What is your name?", "Om Shree");
    const session = manager.getSession("abc123");
    expect(session?.feedbacks).toHaveLength(1);
    expect(session?.feedbacks[0].question).toBe("What is your name?");
    expect(session?.feedbacks[0].answer).toBe("Om Shree");
  });

  it("should return undefined for unknown session", () => {
    const session = manager.getSession("nope");
    expect(session).toBeUndefined();
  });

  it("should delete session on end", () => {
    manager.startSession("abc123");
    manager.endSession("abc123");
    expect(manager.getSession("abc123")).toBeUndefined();
  });

  it("should throw error when recording feedback in unknown session", () => {
    expect(() =>
      manager.recordFeedback("ghost", "Q?", "A?")
    ).toThrowError("Session ghost not found");
  });
});
