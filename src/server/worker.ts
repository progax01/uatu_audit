import { runAll } from "../services/runAll.js";
import { claimNext, complete, JobCancelledError } from "../services/jobQueue.js";
import { logger, createJobLogger } from "../utils/logger.js";

/**
 * Background worker that processes jobs from the queue
 */
export async function startWorker(workerId: number) {
  const log = logger.child({ workerId });
  log.info(`Worker started`);

  while (true) {
    try {
      const job = await claimNext();
      if (!job) {
        // No jobs available, wait a bit
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      const jobLog = createJobLogger(job.id, job.project, job.branch);
      jobLog.info(`Worker processing job`, { workerId });

      try {
        const { htmlPath, score, grade } = await runAll({
          repo: job.repo,
          project: job.project,
          branch: job.branch,
          testStyles: job.testStyles || ["behavioral", "stride"],
          selectedFiles: job.selectedFiles || [],
          ai: job.ai,
          jobId: job.id,
          accessToken: job.accessToken,
        });

        await complete(job.id, true, htmlPath);
        jobLog.info(`Job completed successfully`, {
          htmlPath,
          score,
          grade,
          workerId,
        });
      } catch (error) {
        // Handle cancellation gracefully
        if (error instanceof JobCancelledError) {
          jobLog.info(`Job cancelled by user`, { workerId });
          continue;
        }

        jobLog.error(`Job failed`, { error: String(error), workerId });
        await complete(job.id, false, undefined, String(error));
      }
    } catch (error) {
      log.error(`Worker error`, { error: String(error) });
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
