export type GuardianEvent = {
  timestamp: number;
  severity: "info" | "warning" | "error" | "critical";
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export class GuardianMonitor {
  private static readonly MAX_EVENTS = 200;
  private static readonly events: GuardianEvent[] = [];

  static log(event: GuardianEvent): void {
    try {
      const normalized: GuardianEvent = {
        timestamp:
          typeof event.timestamp === "number" && Number.isFinite(event.timestamp)
            ? event.timestamp
            : Date.now(),
        severity: event.severity,
        source: event.source || "unknown",
        message: event.message || "",
        metadata: event.metadata,
      };

      if (GuardianMonitor.events.length >= GuardianMonitor.MAX_EVENTS) {
        GuardianMonitor.events.shift();
      }
      GuardianMonitor.events.push(normalized);

      GuardianMonitor.safeConsole(normalized);
    } catch {
      // Intentionally swallow errors to avoid impacting application execution.
    }
  }

  static info(source: string, message: string, metadata?: Record<string, unknown>): void {
    GuardianMonitor.log({
      timestamp: Date.now(),
      severity: "info",
      source,
      message,
      metadata,
    });
  }

  static warn(source: string, message: string, metadata?: Record<string, unknown>): void {
    GuardianMonitor.log({
      timestamp: Date.now(),
      severity: "warning",
      source,
      message,
      metadata,
    });
  }

  static error(source: string, message: string, metadata?: Record<string, unknown>): void {
    GuardianMonitor.log({
      timestamp: Date.now(),
      severity: "error",
      source,
      message,
      metadata,
    });
  }

  static critical(source: string, message: string, metadata?: Record<string, unknown>): void {
    GuardianMonitor.log({
      timestamp: Date.now(),
      severity: "critical",
      source,
      message,
      metadata,
    });
  }

  static getRecentEvents(): GuardianEvent[] {
    return [...GuardianMonitor.events];
  }

  private static safeConsole(event: GuardianEvent): void {
    try {
      const payload = {
        source: event.source,
        message: event.message,
        metadata: event.metadata,
        timestamp: event.timestamp,
      };

      if (event.severity === "critical") {
        console.error("[Guardian:critical]", payload);
        return;
      }

      if (event.severity === "error") {
        console.error("[Guardian:error]", payload);
        return;
      }

      if (event.severity === "warning") {
        console.warn("[Guardian:warning]", payload);
        return;
      }

      console.info("[Guardian:info]", payload);
    } catch {
      // Intentionally swallow console errors.
    }
  }
}
