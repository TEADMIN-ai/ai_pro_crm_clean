import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";

let installed = false;

export function initGuardianClient(): void {
  if (typeof window === "undefined" || installed) {
    return;
  }

  installed = true;

  window.addEventListener("error", (event) => {
    GuardianMonitor.log({
      timestamp: Date.now(),
      severity: "error",
      source: "window.error",
      message: event.message || "Unhandled error event",
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      typeof event.reason === "string"
        ? event.reason
        : event.reason instanceof Error
          ? event.reason.message
          : "Unhandled promise rejection";

    GuardianMonitor.log({
      timestamp: Date.now(),
      severity: "error",
      source: "window.unhandledrejection",
      message: reason,
      metadata: {
        reason: event.reason,
      },
    });
  });
}

if (typeof window !== "undefined") {
  initGuardianClient();
}
