import cron from "node-cron";
import { prisma } from "./prisma";
import { runWorkstreamTrigger } from "./trigger-engine";

interface ScheduledJob {
  workstreamId: number;
  workstreamName: string;
  cronExpression: string;
  task: cron.ScheduledTask;
}

const scheduledJobs: Map<number, ScheduledJob> = new Map();

/**
 * Start the scheduler — loads all enabled workstreams with cron expressions
 * and schedules them.
 */
export async function startScheduler() {
  console.log("[Scheduler] Starting scheduler...");

  const workstreams = await prisma.workstream.findMany({
    where: {
      enabled: true,
      cronExpression: { not: null },
      cadence: { not: "manual" },
    },
  });

  for (const ws of workstreams) {
    if (ws.cronExpression) {
      scheduleWorkstream(ws.id, ws.name, ws.cronExpression);
    }
  }

  console.log(
    `[Scheduler] Scheduled ${scheduledJobs.size} workstream(s).`
  );
}

/**
 * Schedule a single workstream by cron expression.
 */
export function scheduleWorkstream(
  workstreamId: number,
  workstreamName: string,
  cronExpression: string
) {
  // Remove existing job if any
  unscheduleWorkstream(workstreamId);

  if (!cron.validate(cronExpression)) {
    console.warn(
      `[Scheduler] Invalid cron for workstream ${workstreamId}: ${cronExpression}`
    );
    return;
  }

  const task = cron.schedule(
    cronExpression,
    async () => {
      console.log(
        `[Scheduler] Running workstream "${workstreamName}" (${workstreamId})...`
      );
      try {
        const result = await runWorkstreamTrigger(
          workstreamId,
          "scheduler",
          "scheduled"
        );

        // Update next run time
        await prisma.workstream.update({
          where: { id: workstreamId },
          data: {
            lastRunAt: new Date(),
            nextRunAt: getNextRunDate(cronExpression),
          },
        });

        console.log(
          `[Scheduler] Workstream "${workstreamName}": ${result.totalEmails} emails generated, ${result.skippedDedupe} skipped.`
        );
      } catch (error) {
        console.error(
          `[Scheduler] Error running workstream "${workstreamName}":`,
          error
        );
      }
    },
    {
      timezone: "America/New_York",
    }
  );

  scheduledJobs.set(workstreamId, {
    workstreamId,
    workstreamName,
    cronExpression,
    task,
  });

  // Update next run time in database
  const nextRun = getNextRunDate(cronExpression);
  prisma.workstream
    .update({
      where: { id: workstreamId },
      data: { nextRunAt: nextRun },
    })
    .catch(() => {}); // fire-and-forget

  console.log(
    `[Scheduler] Scheduled "${workstreamName}" with cron: ${cronExpression}`
  );
}

/**
 * Remove a workstream from the schedule.
 */
export function unscheduleWorkstream(workstreamId: number) {
  const existing = scheduledJobs.get(workstreamId);
  if (existing) {
    existing.task.stop();
    scheduledJobs.delete(workstreamId);
  }
}

/**
 * Refresh scheduler — re-reads all workstreams from database and updates schedule.
 */
export async function refreshScheduler() {
  // Stop all existing jobs
  for (const [, job] of scheduledJobs) {
    job.task.stop();
  }
  scheduledJobs.clear();

  // Re-start
  await startScheduler();
}

/**
 * Get scheduler status.
 */
export function getSchedulerStatus() {
  const jobs = Array.from(scheduledJobs.values()).map((job) => ({
    workstreamId: job.workstreamId,
    workstreamName: job.workstreamName,
    cronExpression: job.cronExpression,
    nextRun: getNextRunDate(job.cronExpression)?.toISOString() ?? null,
  }));

  return {
    running: scheduledJobs.size > 0,
    jobCount: scheduledJobs.size,
    jobs,
  };
}

/**
 * Calculate the next run date from a cron expression.
 * Uses a simple approach - returns approximate next run.
 */
function getNextRunDate(cronExpression: string): Date | null {
  try {
    // Parse cron fields: minute hour dayOfMonth month dayOfWeek
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const now = new Date();
    const [minute, hour, , , dayOfWeek] = parts;

    const targetMinute = minute === "*" ? 0 : parseInt(minute);
    const targetHour = hour === "*" ? 0 : parseInt(hour);

    // Simple next-run calculation
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(targetMinute);
    next.setHours(targetHour);

    if (dayOfWeek !== "*") {
      // Weekly schedule - find next matching day
      const targetDay = parseInt(dayOfWeek); // 0=Sunday, 1=Monday, etc.
      let daysUntil = targetDay - now.getDay();
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && next <= now) daysUntil = 7;
      next.setDate(next.getDate() + daysUntil);
    } else {
      // Daily - if already past today's time, go to tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  } catch {
    return null;
  }
}

/**
 * Stop all scheduled jobs.
 */
export function stopScheduler() {
  for (const [, job] of scheduledJobs) {
    job.task.stop();
  }
  scheduledJobs.clear();
  console.log("[Scheduler] All jobs stopped.");
}
