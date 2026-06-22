import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { createSourceRegistry } from "./connectors/registry.js";
import { processSource } from "./jobs/process-source.js";
import { logError, logInfo } from "./lib/logger.js";

const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const queue = new Queue("event-ingestion", { connection: redis });

const adapters = createSourceRegistry();

const worker = new Worker(
  "event-ingestion",
  async (job) => {
    const adapter = adapters.find((entry) => entry.source === job.data.source);
    if (!adapter) {
      throw new Error(`Unknown source: ${job.data.source}`);
    }

    return processSource({
      adapter,
      cursorOrIso: job.data.cursorOrIso
    });
  },
  { connection: redis }
);

worker.on("completed", (job, result) => {
  logInfo(`Job completed ${job.id}`, result);
});

worker.on("failed", (job, error) => {
  logError(`Job failed ${job?.id}`, error);
});

async function enqueueAllSources() {
  const nowIso = new Date().toISOString();
  for (const adapter of adapters) {
    await queue.add(
      `sync-${adapter.source}`,
      {
        source: adapter.source,
        cursorOrIso: nowIso
      },
      {
        attempts: adapter.retryPolicy.maxRetries,
        backoff: {
          type: "exponential",
          delay: adapter.retryPolicy.baseDelayMs
        },
        removeOnComplete: 50,
        removeOnFail: 200
      }
    );
  }
}

async function runHealthChecks() {
  for (const adapter of adapters) {
    const health = await adapter.sourceHealthCheck();
    logInfo(`Source health: ${adapter.source}`, health);
  }
}

async function main() {
  const cadenceMinutes = Number(process.env.CRAWL_CADENCE_MINUTES ?? "90");
  await runHealthChecks();
  await enqueueAllSources();
  setInterval(() => {
    void enqueueAllSources().catch((error) =>
      logError("Failed to enqueue source sync", error)
    );
  }, cadenceMinutes * 60 * 1000);
  logInfo(`Ingestion worker running. Scheduling cadence: every ${cadenceMinutes} minutes.`);
}

void main().catch((error) => {
  logError("Ingestion worker crashed", error);
  process.exit(1);
});
