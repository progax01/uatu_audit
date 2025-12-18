import { runAll } from "../services/runAll.js";
import { claimNext, complete, JobCancelledError, getJob } from "../services/jobQueue.js";
import { logger, createJobLogger } from "../utils/logger.js";
import { updateRepoHomepage, buildReportUrl } from "../services/githubService.js";

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

        // Update GitHub repo "About" section with report link (non-blocking)
        if (job.accessToken && job.repo && !job.repo.startsWith("scan://")) {
          try {
            // Get updated job to fetch runTimestamp
            const updatedJob = await getJob(job.id);
            if (updatedJob?.runTimestamp) {
              const reportUrl = buildReportUrl(job.project, job.branch, updatedJob.runTimestamp);
              const result = await updateRepoHomepage(job.accessToken, job.repo, reportUrl);
              if (result.success) {
                jobLog.info(`GitHub repo homepage updated with report link`, { reportUrl });
              } else {
                jobLog.warn(`Failed to update GitHub repo homepage`, { error: result.error });
              }
            }
          } catch (ghError) {
            // Don't fail the job if GitHub update fails
            jobLog.warn(`Error updating GitHub repo homepage`, { error: String(ghError) });
          }
        }
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
