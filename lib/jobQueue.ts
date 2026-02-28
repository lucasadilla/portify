import { Queue, Worker, Job } from "bullmq";

export type GenerateJobData = {
  portfolioRepoId: string;
  portfolioId: string;
  repoFullName: string;
  branch: string;
  accessToken?: string;
};

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
function getConnection() {
  try {
    const u = new URL(redisUrl);
    return {
      host: u.hostname,
      port: parseInt(u.port || "6379", 10),
      password: u.password || undefined,
    };
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

export function createGenerateWorker(
  processor: (job: Job<GenerateJobData>) => Promise<void>
): Worker<GenerateJobData> {
  return new Worker<GenerateJobData>("portify-generate", processor, {
    connection: getConnection(),
    concurrency: 2,
  });
}
