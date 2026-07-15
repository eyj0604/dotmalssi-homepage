export interface D1Result<T = Record<string, unknown>> {
  meta?: { changes?: number };
  results?: T[];
  success: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

type FeedbackBindings = {
  DB?: D1DatabaseLike;
  FEEDBACK_ID_PEPPER?: string;
  FEEDBACK_WRITE_ENABLED?: string;
};

export async function isFeedbackWriteEnabled() {
  try {
    const { env } = await import("cloudflare:workers");
    const bindings = env as unknown as FeedbackBindings;
    return bindings.FEEDBACK_WRITE_ENABLED === "true";
  } catch {
    return false;
  }
}

export async function getFeedbackBindings() {
  const { env } = await import("cloudflare:workers");
  const bindings = env as unknown as FeedbackBindings;
  if (!bindings.DB) {
    throw new Error("D1 binding DB is unavailable");
  }
  if (
    !bindings.FEEDBACK_ID_PEPPER ||
    new TextEncoder().encode(bindings.FEEDBACK_ID_PEPPER).byteLength < 32
  ) {
    throw new Error("Feedback identity pepper must be at least 32 bytes");
  }

  return {
    db: bindings.DB,
    pepper: bindings.FEEDBACK_ID_PEPPER,
    feedbackWriteEnabled: bindings.FEEDBACK_WRITE_ENABLED === "true",
  };
}
