import fetch from "node-fetch";
import { URL } from "node:url";
import { logger } from "../utils/logger.js";
import type { ExternalReference } from "./liabilityMap.js";

const log = logger.child({ service: "dependency-verifier" });

export interface VerificationResult {
  ok: boolean;
  reason?: string;
  normalized?: ExternalReference;
}

/**
 * Very lightweight verifier:
 * - Checks that the URL is a valid GitHub repo/file link
 * - Optionally checks HEAD/GET to ensure it exists
 */
export async function verifyGitHubDependency(
  rawUrl: string
): Promise<VerificationResult> {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== "github.com") {
      return { ok: false, reason: "Not a github.com URL" };
    }

    // Pattern: /owner/repo[/...]
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return { ok: false, reason: "GitHub URL missing owner/repo" };
    }

    // HEAD request to check existence
    const resp = await fetch(u.toString(), { method: "HEAD" });
    if (!resp.ok) {
      return { ok: false, reason: `GitHub returned ${resp.status}` };
    }

    const normalized: ExternalReference = {
      type: "github",
      url: u.toString(),
      verified: true,
      last_verified_at: new Date().toISOString(),
    };

    return { ok: true, normalized };
  } catch (err: any) {
    log.warn("Failed to verify GitHub dependency", { error: String(err) });
    return { ok: false, reason: "Invalid URL or network error" };
  }
}

