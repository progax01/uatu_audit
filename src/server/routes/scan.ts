/**
 * Scan Deployed Contract Routes
 *
 * Handles scanning of deployed smart contracts on various blockchains.
 * See docs/scan-deployed-contract-flow.md for full specification.
 */

import path from "node:path";
import fs from "fs-extra";
import {
  validateContract,
  fetchContractSource,
  validateAndFetchContract,
  getCachedContractSource,
  isValidAddress,
  getExplorerUrl,
  detectProxy,
  fetchDeployerAddress,
  NETWORKS,
} from "../../services/explorerService.js";
import { enqueue } from "../../services/jobQueue.js";
import { getUatuHome } from "../../constants/paths.js";
import { logger } from "../../utils/logger.js";
import { performQuickScan, loadContractSource, isQuickScanConfigured } from "../../services/quickScanService.js";
import {
  createQuickScanJob,
  updateJobProgress,
  completeQuickScanJob,
  failQuickScanJob,
  findExistingQuickScan,
  findRunningQuickScan,
  getAuditWithResults,
  getJobStatus,
  countRunningAudits,
  countQueuedAudits,
  setJobQueued,
  getNextQueuedJob,
} from "../../repositories/auditJobRepository.js";

// Maximum concurrent audits allowed
const MAX_CONCURRENT_AUDITS = 1;

/**
 * Process the next queued job if any
 * Called after a scan completes (success or failure) to pick up the next job
 */
async function processNextQueuedJob(): Promise<void> {
  try {
    const runningCount = await countRunningAudits();
    if (runningCount >= MAX_CONCURRENT_AUDITS) {
      return; // Still have running jobs, wait
    }

    const nextJob = await getNextQueuedJob();
    if (nextJob) {
      log.info("Found queued job, updating status to pending for processing", {
        jobId: nextJob.id,
        contractName: nextJob.contractName,
        contractAddress: nextJob.contractAddress,
      });
      // Update status to pending so it can be picked up on next scan request
      // A full background processor would trigger the actual scan here
      await updateJobProgress(nextJob.id, 0, "Ready to start...", "pending");
    }
  } catch (err) {
    log.error("Error processing queue", { error: err });
  }
}

const log = logger.child({ service: "scan-routes" });

/**
 * Parse JSON body from request
 */
async function parseBody(req: any): Promise<any> {
  const chunks: any[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body || "{}");
  } catch {
    return {};
  }
}

/**
 * Get workspace path for scanned contracts
 * Format: ~/.uatu/workspace/scans/{address}_{network}/
 */
async function getScanWorkspace(network: string, address: string): Promise<string> {
  const folderName = `${address.toLowerCase()}_${network}`;
  const scanPath = path.join(getUatuHome(), "workspace", "scans", folderName);
  await fs.ensureDir(scanPath);
  return scanPath;
}

/**
 * Scan route handlers
 */
export async function handleScanRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  // GET /scan/networks - List supported networks
  if (req.method === "GET" && parsed.pathname === "/scan/networks") {
    // V2 API uses a unified key across all chains
    const hasApiKey = !!(process.env.ETHERSCAN_API_KEY || process.env.ARBISCAN_API_KEY || process.env.POLYGONSCAN_API_KEY);
    const networks = Object.entries(NETWORKS).map(([id, config]) => ({
      id,
      name: config.name,
      chainId: config.chainId,
      hasApiKey,
    }));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ networks }));
    return true;
  }

  // GET /scan/job-status/:jobId - Get job status for polling/reconnection
  const jobStatusMatch = parsed.pathname.match(/^\/scan\/job-status\/([a-f0-9-]+)$/i);
  if (req.method === "GET" && jobStatusMatch) {
    try {
      const jobId = jobStatusMatch[1];
      const jobData = await getJobStatus(jobId);

      if (!jobData) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Job not found" }));
        return true;
      }

      const { job, results } = jobData;

      // Build response based on job status
      const response: any = {
        jobId: job.id,
        status: job.status,
        progressPct: job.progressPct,
        progressMessage: job.progressMessage,
        contractName: job.contractName,
        contractAddress: job.contractAddress,
        contractNetwork: job.contractNetwork,
        isProxy: job.isProxy,
        createdAt: job.createdAt,
      };

      // If completed, include redirect URL and results
      if (job.status === "completed") {
        response.redirectUrl = `/audit/${job.id}`;
        if (results) {
          response.score = results.scoreValue;
          response.grade = results.scoreLabel;
          response.summary = results.summary;
          response.vulnerabilityCount = Array.isArray(results.findings) ? results.findings.length : 0;
        }
      }

      // If failed, include error
      if (job.status === "failed") {
        response.error = job.errorMessage;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(response));
      return true;
    } catch (error: any) {
      log.error("Job status lookup failed", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "Failed to get job status" }));
      return true;
    }
  }

  // POST /scan/validate - Validate contract address
  if (req.method === "POST" && parsed.pathname === "/scan/validate") {
    try {
      const body = await parseBody(req);
      const { address, network } = body;

      if (!address) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Address is required" }));
        return true;
      }

      if (!network || !NETWORKS[network]) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "Invalid network",
            supportedNetworks: Object.keys(NETWORKS),
          })
        );
        return true;
      }

      if (!isValidAddress(address)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid address format. Must be 0x followed by 40 hex characters." }));
        return true;
      }

      log.info("Validating contract", { address, network });

      const info = await validateContract(address, network);

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          valid: true,
          ...info,
          explorerUrl: getExplorerUrl(address, network),
        })
      );
      return true;
    } catch (error: any) {
      log.error("Validation failed", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "Validation failed" }));
      return true;
    }
  }

  // POST /scan/validate-and-fetch - Combined validation and source fetch (optimized)
  if (req.method === "POST" && parsed.pathname === "/scan/validate-and-fetch") {
    try {
      const body = await parseBody(req);
      const { address, network } = body;

      if (!address) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Address is required" }));
        return true;
      }

      if (!network || !NETWORKS[network]) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "Invalid network",
            supportedNetworks: Object.keys(NETWORKS),
          })
        );
        return true;
      }

      if (!isValidAddress(address)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid address format. Must be 0x followed by 40 hex characters." }));
        return true;
      }

      // First, validate the contract and check if it's a proxy
      // For proxies, we always audit the implementation address (contract code is in implementation)
      const validationResult = await validateContract(address, network);

      if (!validationResult.isContract) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          isContract: false,
          isVerified: false,
          error: "Address is not a contract"
        }));
        return true;
      }

      // Detect if it's a proxy contract
      const proxyInfo = await detectProxy(address, network);
      const isProxy = proxyInfo.isProxy;
      const implementationAddress = proxyInfo.implementationAddress;
      const effectiveAddress = isProxy && implementationAddress
        ? implementationAddress
        : address;

      log.info("Contract validation and proxy detection", {
        originalAddress: address,
        effectiveAddress,
        isProxy,
        implementationAddress,
        network,
      });

      // Check if there's already a running quick scan for the effective address (implementation for proxies)
      const runningJob = await findRunningQuickScan(effectiveAddress, network);
      if (runningJob) {
        log.info("Found running quick scan job for effective address", {
          jobId: runningJob.id,
          originalAddress: address,
          effectiveAddress,
          network,
          status: runningJob.status,
          progressPct: runningJob.progressPct,
        });

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          isContract: true,
          isVerified: validationResult.isVerified,
          contractName: runningJob.contractName,
          isProxy,
          implementationAddress,
          // Signal that a scan is already running
          runningJob: {
            jobId: runningJob.id,
            status: runningJob.status,
            progressPct: runningJob.progressPct,
            progressMessage: runningJob.progressMessage,
            startedAt: runningJob.startedAt,
          },
        }));
        return true;
      }

      // Check if there's an existing completed audit for the effective address
      const existingAudit = await findExistingQuickScan(effectiveAddress, network);
      let existingAuditInfo: any = null;

      if (existingAudit) {
        const auditData = await getAuditWithResults(existingAudit.id);
        log.info("Found existing completed audit for effective address", {
          jobId: existingAudit.id,
          originalAddress: address,
          effectiveAddress,
          network,
          score: auditData?.results?.scoreValue,
        });

        existingAuditInfo = {
          jobId: existingAudit.id,
          completedAt: existingAudit.completedAt,
          score: auditData?.results?.scoreValue,
          grade: auditData?.results?.scoreLabel,
          vulnerabilityCount: Array.isArray(auditData?.results?.findings) ? auditData.results.findings.length : 0,
        };
      }

      // Check if already cached in workspace (skip re-fetching)
      const workspacePath = await getScanWorkspace(network, address);
      const metadataPath = path.join(workspacePath, "metadata.json");
      const contractsPath = path.join(workspacePath, "contracts");

      if (await fs.pathExists(metadataPath) && await fs.pathExists(contractsPath)) {
        const metadata = await fs.readJson(metadataPath);

        // Validate that required fields exist in cached metadata
        // If missing, we'll fall through to re-fetch from explorer API
        const hasRequiredFields = metadata.contractName && metadata.compiler;

        if (!hasRequiredFields) {
          log.info("Cached metadata incomplete, will re-fetch from explorer", {
            address,
            network,
            hasContractName: !!metadata.contractName,
            hasCompiler: !!metadata.compiler,
          });
          // Fall through to re-fetch from explorer
        } else {
          // Recursively find all .sol files (they may be nested in subdirs)
          const findSolFilesRecursive = async (dir: string): Promise<string[]> => {
            const results: string[] = [];
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                results.push(...await findSolFilesRecursive(fullPath));
              } else if (entry.name.endsWith('.sol')) {
                results.push(entry.name);
              }
            }
            return results;
          };

          const solFiles = await findSolFilesRecursive(contractsPath);

          if (solFiles.length > 0) {
            log.info("Using cached workspace - skipping fetch", {
              address,
              network,
              files: solFiles.length,
              hasExistingAudit: !!existingAuditInfo,
            });

            const response: any = {
              isContract: true,
              isVerified: true,
              contractName: metadata.contractName,
              compiler: metadata.compiler,
              optimization: metadata.optimization,
              runs: metadata.runs,
              evmVersion: metadata.evmVersion,
              licenseType: metadata.licenseType,
              isProxy: metadata.isProxy || false,
              implementationAddress: metadata.implementationAddress,
              implementationName: metadata.implementationName,
              deployerAddress: metadata.deployerAddress,
              creationTxHash: metadata.creationTxHash,
              files: solFiles,
              fileCount: solFiles.length,
              cached: true,
              explorerUrl: metadata.explorerUrl || getExplorerUrl(address, network),
            };

            // Include existing audit info if available
            if (existingAuditInfo) {
              response.existingAudit = existingAuditInfo;
            }

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(response));
            return true;
          }
        }
      }

      log.info("Fetching contract from explorer", { address, network });

      const result = await validateAndFetchContract(address, network);

      // If validated and verified, save to workspace
      if (result.isContract && result.isVerified) {
        const cachedSource = getCachedContractSource(address, network);
        if (cachedSource) {
          const workspacePath = await getScanWorkspace(network, address);
          const contractsPath = path.join(workspacePath, "contracts");
          await fs.ensureDir(contractsPath);

          // Write all source files (including implementation if proxy)
          for (const [filename, content] of Object.entries(cachedSource.sources)) {
            const filePath = path.join(contractsPath, filename);
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, content);
          }

          // If proxy, also write implementation sources
          if (cachedSource.implementationSource) {
            for (const [filename, content] of Object.entries(cachedSource.implementationSource.sources)) {
              const filePath = path.join(contractsPath, filename);
              await fs.ensureDir(path.dirname(filePath));
              await fs.writeFile(filePath, content);
            }
          }

          // Write metadata
          await fs.writeJson(
            path.join(workspacePath, "metadata.json"),
            {
              address,
              network,
              contractName: cachedSource.contractName,
              compiler: cachedSource.compiler,
              optimization: cachedSource.optimization,
              runs: cachedSource.runs,
              evmVersion: cachedSource.evmVersion,
              licenseType: cachedSource.licenseType,
              isProxy: cachedSource.isProxy,
              implementationAddress: cachedSource.implementationAddress,
              implementationName: cachedSource.implementationName,
              deployerAddress: cachedSource.deployerAddress,
              creationTxHash: cachedSource.creationTxHash,
              fetchedAt: new Date().toISOString(),
              explorerUrl: getExplorerUrl(address, network),
            },
            { spaces: 2 }
          );

          // Write ABI
          await fs.writeJson(path.join(workspacePath, "abi.json"), cachedSource.abi, { spaces: 2 });
        }
      }

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return true;
    } catch (error: any) {
      log.error("Validate and fetch failed", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "Validation failed" }));
      return true;
    }
  }

  // POST /scan/fetch - Fetch contract source code
  if (req.method === "POST" && parsed.pathname === "/scan/fetch") {
    try {
      const body = await parseBody(req);
      const { address, network } = body;

      if (!address || !network) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Address and network are required" }));
        return true;
      }

      if (!NETWORKS[network]) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid network" }));
        return true;
      }

      log.info("Fetching contract source", { address, network });

      const source = await fetchContractSource(address, network);

      // Save to workspace
      const workspacePath = await getScanWorkspace(network, address);
      const contractsPath = path.join(workspacePath, "contracts");
      await fs.ensureDir(contractsPath);

      // Write each source file
      for (const [filename, content] of Object.entries(source.sources)) {
        const filePath = path.join(contractsPath, filename);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
      }

      // Write metadata
      await fs.writeJson(
        path.join(workspacePath, "metadata.json"),
        {
          address,
          network,
          contractName: source.contractName,
          compiler: source.compiler,
          optimization: source.optimization,
          runs: source.runs,
          evmVersion: source.evmVersion,
          licenseType: source.licenseType,
          fetchedAt: new Date().toISOString(),
          explorerUrl: getExplorerUrl(address, network),
        },
        { spaces: 2 }
      );

      // Write ABI
      await fs.writeJson(path.join(workspacePath, "abi.json"), source.abi, { spaces: 2 });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          contractName: source.contractName,
          compiler: source.compiler,
          optimization: source.optimization,
          runs: source.runs,
          fileCount: Object.keys(source.sources).length,
          files: Object.keys(source.sources),
          workspacePath,
        })
      );
      return true;
    } catch (error: any) {
      log.error("Fetch failed", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "Failed to fetch source" }));
      return true;
    }
  }

  // POST /scan/enqueue - Queue scan job (uses cached source if available)
  if (req.method === "POST" && parsed.pathname === "/scan/enqueue") {
    try {
      const body = await parseBody(req);
      const { address, network, scanMode } = body;

      if (!address || !network) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Address and network are required" }));
        return true;
      }

      if (!NETWORKS[network]) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid network" }));
        return true;
      }

      log.info("Enqueuing scan job", { address, network, scanMode });

      const workspacePath = await getScanWorkspace(network, address);
      const metadataPath = path.join(workspacePath, "metadata.json");

      let contractName = "Contract";
      let isProxy = false;
      let implementationAddressFromMeta: string | undefined;
      let deployerAddressFromMeta: string | undefined;
      let creationTxHashFromMeta: string | undefined;

      // Check if already saved to workspace
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        contractName = metadata.contractName || "Contract";
        isProxy = metadata.isProxy || false;
        implementationAddressFromMeta = metadata.implementationAddress;
        deployerAddressFromMeta = metadata.deployerAddress;
        creationTxHashFromMeta = metadata.creationTxHash;
        log.info("Using existing workspace", { address, contractName, isProxy, implementationAddressFromMeta, deployerAddressFromMeta });
      } else {
        // Try to use cached source first (from validate-and-fetch)
        const cachedSource = getCachedContractSource(address, network);

        if (cachedSource) {
          log.info("Using cached source for enqueue", { address, contractName: cachedSource.contractName });
          contractName = cachedSource.contractName;
          isProxy = cachedSource.isProxy;

          // Save to workspace
          const contractsPath = path.join(workspacePath, "contracts");
          await fs.ensureDir(contractsPath);

          for (const [filename, content] of Object.entries(cachedSource.sources)) {
            const filePath = path.join(contractsPath, filename);
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, content);
          }

          // Also write implementation sources if proxy
          if (cachedSource.implementationSource) {
            for (const [filename, content] of Object.entries(cachedSource.implementationSource.sources)) {
              const filePath = path.join(contractsPath, filename);
              await fs.ensureDir(path.dirname(filePath));
              await fs.writeFile(filePath, content);
            }
          }

          await fs.writeJson(
            metadataPath,
            {
              address,
              network,
              contractName: cachedSource.contractName,
              compiler: cachedSource.compiler,
              optimization: cachedSource.optimization,
              runs: cachedSource.runs,
              evmVersion: cachedSource.evmVersion,
              licenseType: cachedSource.licenseType,
              isProxy: cachedSource.isProxy,
              implementationAddress: cachedSource.implementationAddress,
              implementationName: cachedSource.implementationName,
              deployerAddress: cachedSource.deployerAddress,
              creationTxHash: cachedSource.creationTxHash,
              fetchedAt: new Date().toISOString(),
              explorerUrl: getExplorerUrl(address, network),
            },
            { spaces: 2 }
          );

          // Also update local vars for job creation
          deployerAddressFromMeta = cachedSource.deployerAddress;
          creationTxHashFromMeta = cachedSource.creationTxHash;

          await fs.writeJson(path.join(workspacePath, "abi.json"), cachedSource.abi, { spaces: 2 });
        } else {
          // Fallback: fetch fresh (shouldn't happen if validate-and-fetch was called)
          log.warn("No cached source, fetching fresh", { address });
          const source = await fetchContractSource(address, network);
          contractName = source.contractName;

          const contractsPath = path.join(workspacePath, "contracts");
          await fs.ensureDir(contractsPath);

          for (const [filename, content] of Object.entries(source.sources)) {
            const filePath = path.join(contractsPath, filename);
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, content);
          }

          await fs.writeJson(
            metadataPath,
            {
              address,
              network,
              contractName: source.contractName,
              compiler: source.compiler,
              optimization: source.optimization,
              runs: source.runs,
              evmVersion: source.evmVersion,
              licenseType: source.licenseType,
              fetchedAt: new Date().toISOString(),
              explorerUrl: getExplorerUrl(address, network),
            },
            { spaces: 2 }
          );

          await fs.writeJson(path.join(workspacePath, "abi.json"), source.abi, { spaces: 2 });
        }
      }

      // For proxy contracts, always use implementation address for audits
      // The actual code/logic is in the implementation, not the proxy
      const effectiveAddress = isProxy && implementationAddressFromMeta
        ? implementationAddressFromMeta
        : address;

      // Create project name from contract
      const shortAddress = `${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}`;
      const projectName = `${contractName}-${shortAddress}`;

      log.info("Effective address for audit", {
        originalAddress: address,
        effectiveAddress,
        isProxy,
        implementationAddress: implementationAddressFromMeta,
      });

      // QUICK SCAN: Run immediately with Claude CLI, save to database
      if (scanMode === "quick") {
        log.info("Running quick scan with Claude CLI", { contractName, effectiveAddress });

        // Check if there's already a running quick scan for the effective address (implementation for proxies)
        // This prevents duplicate scans from being started
        const runningJob = await findRunningQuickScan(effectiveAddress, network);
        if (runningJob) {
          log.info("Quick scan already in progress for effective address", {
            jobId: runningJob.id,
            originalAddress: address,
            effectiveAddress,
            network,
            status: runningJob.status,
            progressPct: runningJob.progressPct,
          });

          // Return info about the running job
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              scanMode: "quick",
              alreadyRunning: true,
              jobId: runningJob.id,
              projectName,
              status: runningJob.status,
              progressPct: runningJob.progressPct,
              progressMessage: runningJob.progressMessage,
              message: isProxy
                ? "A scan is already in progress for this implementation contract"
                : "A scan is already in progress for this contract",
            })
          );
          return true;
        }

        // Check if we already have a completed quick scan for the effective address
        const existingJob = await findExistingQuickScan(effectiveAddress, network);
        if (existingJob) {
          const existingResult = await getAuditWithResults(existingJob.id);
          if (existingResult?.results) {
            log.info("Using existing quick scan from database", {
              jobId: existingJob.id,
              address,
              network,
              score: existingResult.results.scoreValue,
            });

            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: true,
                scanMode: "quick",
                cached: true,
                jobId: existingJob.id,
                projectName,
                workspacePath,
                isProxy,
                redirectUrl: `/audit/${existingJob.id}`,
                quickScanResult: {
                  success: true,
                  score: existingResult.results.scoreValue,
                  grade: existingResult.results.scoreLabel,
                  vulnerabilities: existingResult.results.findings,
                  summary: existingResult.results.summary,
                  ...(existingResult.results.metadata as Record<string, unknown> || {}),
                },
              })
            );
            return true;
          }
        }

        // Check if Claude CLI is available
        if (!isQuickScanConfigured()) {
          log.error("Claude CLI not available");
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: "Quick scan unavailable - Claude CLI not installed",
            message: "Please install Claude CLI: npm install -g @anthropic-ai/claude-code"
          }));
          return true;
        }

        // Load metadata for compiler info
        let compiler: string | undefined;
        let optimization: boolean | undefined;
        let runs: number | undefined;
        let implementationAddress: string | undefined;
        if (await fs.pathExists(metadataPath)) {
          const metadata = await fs.readJson(metadataPath);
          compiler = metadata.compiler;
          optimization = metadata.optimization;
          runs = metadata.runs;
          implementationAddress = metadata.implementationAddress;
        }

        // Check queue - if another audit is running, queue this one
        const runningCount = await countRunningAudits();
        if (runningCount >= MAX_CONCURRENT_AUDITS) {
          const queuedCount = await countQueuedAudits();
          const queuePosition = queuedCount + 1;

          // Create job with pending status (will be set to queued)
          // For proxies, we use implementation address as the contract address
          const queuedJob = await createQuickScanJob({
            contractAddress: effectiveAddress,
            contractNetwork: network,
            contractName,
            isProxy,
            implementationAddress: isProxy ? effectiveAddress : undefined,
            deployerAddress: deployerAddressFromMeta,
            creationTxHash: creationTxHashFromMeta,
          });

          // Update to queued status
          await setJobQueued(queuedJob.id, queuePosition);

          log.info("Quick scan queued - another audit is running", {
            jobId: queuedJob.id,
            queuePosition,
            runningCount,
            contractName,
            effectiveAddress,
            isProxy,
          });

          // Return JSON response (not SSE) for queued jobs
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: true,
            queued: true,
            jobId: queuedJob.id,
            queuePosition,
            message: `Audit queued - another scan is in progress (position ${queuePosition})`,
            contractName,
            network,
            isProxy,
          }));
          return true;
        }

        // Create audit job in database FIRST
        // For proxies, we use implementation address as the contract address
        const auditJob = await createQuickScanJob({
          contractAddress: effectiveAddress,
          contractNetwork: network,
          contractName,
          isProxy,
          implementationAddress: isProxy ? effectiveAddress : undefined,
          deployerAddress: deployerAddressFromMeta,
          creationTxHash: creationTxHashFromMeta,
        });

        log.info("Created quick scan job", { jobId: auditJob.id, contractName, effectiveAddress, isProxy, deployerAddress: deployerAddressFromMeta });

        // Setup SSE response for progress streaming
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Disable nginx buffering
        });

        // Phase tracking for granular progress
        interface Phase {
          name: string;
          label: string;
          status: 'pending' | 'active' | 'complete';
          pct: number;
          weight: number;
        }

        const phases: Phase[] = [
          { name: 'CONTRACT_PARSE', label: 'Contract Parse', status: 'pending', pct: 0, weight: 10 },
          { name: 'SYMBOLIC_ANALYSIS', label: 'Symbolic Analysis', status: 'pending', pct: 0, weight: 25 },
          { name: 'CONTROL_FLOW', label: 'Control Flow Graph', status: 'pending', pct: 0, weight: 20 },
          { name: 'REENTRANCY', label: 'Reentrancy Hooks', status: 'pending', pct: 0, weight: 15 },
          { name: 'ACCESS_CONTROL', label: 'Access Control', status: 'pending', pct: 0, weight: 15 },
          { name: 'VULNERABILITY_SCAN', label: 'Vulnerability Scan', status: 'pending', pct: 0, weight: 10 },
          { name: 'REPORT_GEN', label: 'Report Generation', status: 'pending', pct: 0, weight: 5 },
        ];

        const logs: string[] = [];
        let currentMessage = "Initializing scan...";
        let lastProgressUpdate = Date.now();
        let scanStartTime = Date.now();
        let receivedAnyProgress = false;

        // Calculate overall progress from phases
        const calculateOverallProgress = (): number => {
          let totalProgress = 0;
          for (const phase of phases) {
            totalProgress += (phase.pct / 100) * phase.weight;
          }
          return Math.round(totalProgress);
        };

        // Simulate progress when no updates received (fallback)
        const simulateProgress = () => {
          const elapsedSeconds = (Date.now() - scanStartTime) / 1000;
          const estimatedTotalSeconds = 120; // Estimate 2 minutes for scan

          // Calculate simulated progress (slower at start, faster in middle, slower at end)
          let simulatedPct = Math.min(90, (elapsedSeconds / estimatedTotalSeconds) * 100);

          // Apply easing curve (sigmoid-like)
          simulatedPct = 100 / (1 + Math.exp(-0.1 * (simulatedPct - 50)));
          simulatedPct = Math.min(90, Math.round(simulatedPct)); // Cap at 90% until completion

          const currentPct = calculateOverallProgress();
          if (simulatedPct > currentPct) {
            // Advance to next pending/active phase
            for (const phase of phases) {
              if (phase.status === 'pending') {
                phase.status = 'active';
                phase.pct = 20;
                currentMessage = `Analyzing: ${phase.label}...`;
                break;
              } else if (phase.status === 'active' && phase.pct < 100) {
                phase.pct = Math.min(100, phase.pct + 15);
                if (phase.pct >= 100) {
                  phase.status = 'complete';
                }
                break;
              }
            }
          }
        };

        // Helper to send SSE event
        const sendProgress = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Start progress simulation interval (runs every 3 seconds)
        const progressInterval = setInterval(() => {
          const timeSinceLastUpdate = Date.now() - lastProgressUpdate;

          // If no progress received in 5 seconds, simulate it
          if (!receivedAnyProgress || timeSinceLastUpdate > 5000) {
            simulateProgress();

            sendProgress({
              jobId: auditJob.id,
              status: "auditing",
              progressPct: calculateOverallProgress(),
              message: currentMessage,
              phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
              logs: logs.slice(-20),
              simulated: true, // Indicate this is simulated progress
            });
          }
        }, 3000); // Every 3 seconds

        // Send initial progress
        sendProgress({
          jobId: auditJob.id,
          status: "pending",
          progressPct: 0,
          message: "Initializing scan...",
          phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
          logs: [],
        });

        try {
          // Load contract source and count SLOC
          const sourceCode = await loadContractSource(workspacePath);
          const sloc = sourceCode.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;

          log.info("Contract analysis", { jobId: auditJob.id, contractName, sloc, sourceLength: sourceCode.length });

          // Send fetching progress
          await updateJobProgress(auditJob.id, 5, "Loading contract source...", "analyzing");
          sendProgress({
            jobId: auditJob.id,
            status: "analyzing",
            progressPct: 5,
            message: `Loaded ${sloc} lines of Solidity code`,
            phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
            logs,
            contractInfo: { sloc, contractName, network },
          });

          // Run quick scan with progress callbacks
          const quickResult = await performQuickScan({
            contractName,
            sourceCode: sloc <= 1000 ? sourceCode : '', // Only pass code for small contracts
            network,
            address,
            compiler,
            optimization,
            runs,
            workspacePath: sloc > 1000 ? workspacePath : undefined,
            onProgress: (phase, pct, message) => {
              // Mark that we received real progress from Claude
              receivedAnyProgress = true;
              lastProgressUpdate = Date.now();

              // Handle heartbeat - send keep-alive without updating phases
              if (phase === 'HEARTBEAT') {
                sendProgress({
                  jobId: auditJob.id,
                  status: "auditing",
                  progressPct: calculateOverallProgress(),
                  message: currentMessage,
                  heartbeat: true,
                  phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
                });
                return;
              }

              // Update the matching phase
              const phaseObj = phases.find(p => p.name === phase);
              if (phaseObj) {
                // Mark previous phases as complete
                const phaseIndex = phases.indexOf(phaseObj);
                for (let i = 0; i < phaseIndex; i++) {
                  if (phases[i].status !== 'complete') {
                    phases[i].status = 'complete';
                    phases[i].pct = 100;
                  }
                }

                phaseObj.status = pct >= 100 ? 'complete' : 'active';
                phaseObj.pct = Math.min(100, pct);
                currentMessage = message;

                const overallPct = calculateOverallProgress();

                // Send SSE update
                sendProgress({
                  jobId: auditJob.id,
                  status: "auditing",
                  progressPct: overallPct,
                  message,
                  phase,
                  phasePct: pct,
                  phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
                  logs: logs.slice(-20), // Last 20 log lines
                });

                // Update DB progress
                updateJobProgress(auditJob.id, overallPct, message, "auditing").catch(err => {
                  log.error('Failed to update job progress', { err, jobId: auditJob.id });
                });
              }
            },
            onLog: (line) => {
              logs.push(line);
              // Only send log updates periodically to avoid flooding
              if (logs.length % 5 === 0) {
                sendProgress({
                  jobId: auditJob.id,
                  status: "auditing",
                  progressPct: calculateOverallProgress(),
                  message: currentMessage,
                  phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
                  logs: logs.slice(-20),
                });
              }
            },
          });

          // Stop progress simulation
          clearInterval(progressInterval);

          // Mark all phases as complete
          for (const phase of phases) {
            phase.status = 'complete';
            phase.pct = 100;
          }

          // Update progress: Saving results
          await updateJobProgress(auditJob.id, 95, "Saving results...", "generating");
          sendProgress({
            jobId: auditJob.id,
            status: "generating",
            progressPct: 95,
            message: "Saving results...",
            phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
            logs: logs.slice(-20),
          });

          // Save results to database
          await completeQuickScanJob(auditJob.id, {
            score: quickResult.score,
            grade: quickResult.grade,
            riskLevel: quickResult.riskLevel,
            vulnerabilities: quickResult.vulnerabilities,
            summary: quickResult.summary,
            contractAnalysis: quickResult.contractAnalysis,
            gasOptimizations: quickResult.gasOptimizations,
            bestPractices: quickResult.bestPractices,
            scanDuration: quickResult.scanDuration,
            // NEW: Comprehensive report fields
            technicalChecks: quickResult.technicalChecks,
            businessRiskChecks: quickResult.businessRiskChecks,
            functionOverview: quickResult.functionOverview,
          });

          // Also save to file for backwards compatibility
          const quickScanPath = path.join(workspacePath, "quick-scan-result.json");
          await fs.writeJson(quickScanPath, {
            ...quickResult,
            jobId: auditJob.id,
            contractName,
            address,
            network,
            sloc,
            timestamp: new Date().toISOString(),
          }, { spaces: 2 });

          log.info("Quick scan complete", {
            jobId: auditJob.id,
            contractName,
            score: quickResult.score,
            vulnerabilities: quickResult.vulnerabilities.length,
            sloc,
          });

          // Send completion event
          sendProgress({
            jobId: auditJob.id,
            status: "completed",
            progressPct: 100,
            message: "Scan complete!",
            redirectUrl: `/audit/${auditJob.id}`,
            quickScanResult: quickResult,
            phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
            logs: logs.slice(-20),
          });

          // Process next queued job (if any)
          processNextQueuedJob().catch(err => {
            log.error("Failed to process queue after completion", { error: err });
          });

          res.end();
          return true;
        } catch (quickError: any) {
          log.error("Quick scan failed", { jobId: auditJob.id, error: quickError.message });

          // Stop progress simulation
          clearInterval(progressInterval);

          // Mark job as failed
          await failQuickScanJob(auditJob.id, quickError.message);

          // Send error event
          sendProgress({
            jobId: auditJob.id,
            status: "failed",
            progressPct: 0,
            message: quickError.message || "Scan failed",
            error: quickError.message,
            phases: phases.map(p => ({ name: p.name, label: p.label, status: p.status, pct: p.pct })),
            logs: logs.slice(-20),
          });

          // Process next queued job (if any)
          processNextQueuedJob().catch(err => {
            log.error("Failed to process queue after failure", { error: err });
          });

          res.end();
          return true;
        }
      }

      // FULL AUDIT: Enqueue to job queue (uses Claude)
      const job = await enqueue({
        repo: `scan://${network}/${address}`, // Special scan:// protocol
        project: projectName,
        branch: "main",
        ai: true, // Always true for full audits
        testStyles: ["behavioral", "stride", "owasp"],
      });

      log.info("Full audit job enqueued", { jobId: job.id, projectName, isProxy });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          scanMode: "full",
          job,
          projectName,
          workspacePath,
          isProxy,
        })
      );
      return true;
    } catch (error: any) {
      log.error("Enqueue failed", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error.message || "Failed to enqueue job" }));
      return true;
    }
  }

  return false;
}
