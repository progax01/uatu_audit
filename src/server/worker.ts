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
        jobLog.info(`[GitHub Update] Checking conditions`, {
          hasAccessToken: !!job.accessToken,
          accessTokenLength: job.accessToken?.length || 0,
          repo: job.repo,
          isScanProtocol: job.repo?.startsWith("scan://")
        });

        if (job.accessToken && job.repo && !job.repo.startsWith("scan://")) {
          jobLog.info(`[GitHub Update] Conditions met, proceeding with update`);
          try {
            // Get updated job to fetch runTimestamp
            const updatedJob = await getJob(job.id);
            jobLog.info(`[GitHub Update] Got updated job`, {
              hasRunTimestamp: !!updatedJob?.runTimestamp,
              runTimestamp: updatedJob?.runTimestamp
            });

            if (updatedJob?.runTimestamp) {
              const reportUrl = buildReportUrl(job.project, job.branch, updatedJob.runTimestamp);
              jobLog.info(`[GitHub Update] Calling updateRepoHomepage`, { reportUrl, repo: job.repo });
              const result = await updateRepoHomepage(job.accessToken, job.repo, reportUrl);
              if (result.success) {
                jobLog.info(`[GitHub Update] SUCCESS - GitHub repo homepage updated`, { reportUrl });
              } else {
                jobLog.warn(`[GitHub Update] FAILED - Could not update GitHub repo homepage`, { error: result.error });
              }
            } else {
              jobLog.warn(`[GitHub Update] SKIPPED - No runTimestamp found`);
            }
          } catch (ghError) {
            // Don't fail the job if GitHub update fails
            jobLog.error(`[GitHub Update] ERROR - Exception during GitHub update`, { error: String(ghError) });
          }
        } else {
          jobLog.info(`[GitHub Update] SKIPPED - Conditions not met`, {
            reason: !job.accessToken ? "No accessToken" : job.repo?.startsWith("scan://") ? "Scan protocol" : "No repo"
          });
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
