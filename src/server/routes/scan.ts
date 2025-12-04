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
  isValidAddress,
  getExplorerUrl,
  NETWORKS,
} from "../../services/explorerService.js";
import { enqueue } from "../../services/jobQueue.js";
import { getUatuHome } from "../../constants/paths.js";
import { logger } from "../../utils/logger.js";

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
 */
async function getScanWorkspace(network: string, address: string): Promise<string> {
  const scanPath = path.join(getUatuHome(), "workspace", "scans", network, address.toLowerCase());
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

  // POST /scan/enqueue - Queue scan job
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

      // First fetch the source if not already fetched
      const workspacePath = await getScanWorkspace(network, address);
      const metadataPath = path.join(workspacePath, "metadata.json");

      let contractName = "Contract";
      if (!(await fs.pathExists(metadataPath))) {
        // Fetch source first
        const source = await fetchContractSource(address, network);
        contractName = source.contractName;

        // Save to workspace
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
      } else {
        const metadata = await fs.readJson(metadataPath);
        contractName = metadata.contractName || "Contract";
      }

      // Create project name from contract
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      const projectName = `${contractName}-${shortAddress}`;

      // Enqueue the job
      const job = await enqueue({
        repo: `scan://${network}/${address}`, // Special scan:// protocol
        project: projectName,
        branch: "main",
        ai: scanMode === "full",
        testStyles: scanMode === "full" ? ["behavioral", "stride"] : ["behavioral"],
      });

      log.info("Scan job enqueued", { jobId: job.id, projectName });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          job,
          projectName,
          workspacePath,
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
