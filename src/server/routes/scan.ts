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
  NETWORKS,
} from "../../services/explorerService.js";
import { enqueue } from "../../services/jobQueue.js";
import { getUatuHome } from "../../constants/paths.js";
import { logger } from "../../utils/logger.js";
import { performQuickScan, loadContractSource, isQuickScanConfigured } from "../../services/quickScanService.js";

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

      // Check if already cached in workspace (skip re-fetching)
      const workspacePath = await getScanWorkspace(network, address);
      const metadataPath = path.join(workspacePath, "metadata.json");
      const contractsPath = path.join(workspacePath, "contracts");

      if (await fs.pathExists(metadataPath) && await fs.pathExists(contractsPath)) {
        const metadata = await fs.readJson(metadataPath);

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
          log.info("Using cached workspace - skipping fetch", { address, network, files: solFiles.length });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
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
            files: solFiles,
            fileCount: solFiles.length,
            cached: true,
            explorerUrl: metadata.explorerUrl || getExplorerUrl(address, network),
          }));
          return true;
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

      // Check if already saved to workspace
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        contractName = metadata.contractName || "Contract";
        isProxy = metadata.isProxy || false;
        log.info("Using existing workspace", { address, contractName });
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
              fetchedAt: new Date().toISOString(),
              explorerUrl: getExplorerUrl(address, network),
            },
            { spaces: 2 }
          );

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

      // Create project name from contract
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const projectName = `${contractName}-${shortAddress}`;

      // QUICK SCAN: Run immediately with Claude CLI (no job queue)
      if (scanMode === "quick") {
        log.info("Running quick scan with Claude CLI", { contractName, address });

        const quickScanPath = path.join(workspacePath, "quick-scan-result.json");

        // Check if we already have a cached quick scan result
        if (await fs.pathExists(quickScanPath)) {
          try {
            const cachedResult = await fs.readJson(quickScanPath);
            log.info("Using cached quick scan result", {
              address,
              network,
              score: cachedResult.score,
              timestamp: cachedResult.timestamp,
            });

            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: true,
                scanMode: "quick",
                cached: true,
                projectName,
                workspacePath,
                isProxy,
                quickScanResult: cachedResult,
              })
            );
            return true;
          } catch (cacheError) {
            log.warn("Failed to read cached result, running fresh scan", { error: cacheError });
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

        try {
          // Load metadata for compiler info
          let compiler: string | undefined;
          let optimization: boolean | undefined;
          let runs: number | undefined;
          if (await fs.pathExists(metadataPath)) {
            const metadata = await fs.readJson(metadataPath);
            compiler = metadata.compiler;
            optimization = metadata.optimization;
            runs = metadata.runs;
          }

          // Load contract source and count SLOC
          const sourceCode = await loadContractSource(workspacePath);
          const sloc = sourceCode.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;

          log.info("Contract analysis", { contractName, sloc, sourceLength: sourceCode.length });

          // Run quick scan - for large contracts (>1000 SLOC), use file-based approach
          const quickResult = await performQuickScan({
            contractName,
            sourceCode: sloc <= 1000 ? sourceCode : '', // Only pass code for small contracts
            network,
            address,
            compiler,
            optimization,
            runs,
            workspacePath: sloc > 1000 ? workspacePath : undefined, // Let Claude read files for large contracts
          });

          // Save quick scan results
          await fs.writeJson(quickScanPath, {
            ...quickResult,
            contractName,
            address,
            network,
            sloc,
            timestamp: new Date().toISOString(),
          }, { spaces: 2 });

          log.info("Quick scan complete", {
            contractName,
            score: quickResult.score,
            vulnerabilities: quickResult.vulnerabilities.length,
            sloc,
          });

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              scanMode: "quick",
              cached: false,
              projectName,
              workspacePath,
              isProxy,
              quickScanResult: quickResult,
            })
          );
          return true;
        } catch (quickError: any) {
          log.error("Quick scan failed", { error: quickError.message });
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: "Quick scan failed",
            message: quickError.message || "An error occurred during scanning"
          }));
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
