import { Queue, Worker, Job } from "bullmq";

export type GenerateJobData = {
  portfolioRepoId: string;
  portfolioId: string;
  repoFullName: string;
  branch: string;
  accessToken?: string;
};

function getConnection() {
  try {
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    const u = new URL(redisUrl);
    const port = parseInt(u.port || "6379", 10);
    const opts: { host: string; port: number; password?: string; tls?: object } = {
      host: u.hostname,
      port,
      password: u.password || undefined,
    };
    if (u.protocol === "rediss:") opts.tls = {};
    return opts;
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

let _queue: Queue<GenerateJobData> | null = null;
function getQueue() {
  if (!_queue) {
    _queue = new Queue<GenerateJobData>("portify-generate", {
      connection: getConnection(),
      defaultJobOptions: { attempts: 1, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
    });
  }
  return _queue;
}

export async function addGenerateJob(data: GenerateJobData): Promise<Job<GenerateJobData>> {
  return getQueue().add("generate", data, { jobId: data.portfolioRepoId });
}

const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 min — jobs can run several minutes (clone, analyze, summary, build, diagram)
const LOCK_RENEW_MS = 30 * 1000; // renew lock every 30s so job is not marked stalled

export function createGenerateWorker(
  processor: (job: Job<GenerateJobData>) => Promise<void>
): Worker<GenerateJobData> {
  return new Worker<GenerateJobData>("portify-generate", processor, {
    connection: getConnection(),
    concurrency: 2,
    lockDuration: LOCK_DURATION_MS,
    lockRenewTime: LOCK_RENEW_MS,
  });
}
