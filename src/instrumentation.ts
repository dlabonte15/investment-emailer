export async function register() {
  // Only run on the Node.js server, not in Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    // Start the cron scheduler after a small delay to let DB connections initialize
    setTimeout(() => {
      startScheduler().catch((err) =>
        console.error("[Scheduler] Failed to start:", err)
      );
    }, 3000);
  }
}
