import path from "node:path";
import fs from "fs-extra";
import { executeClaude } from "../services/ai/claudeCLIProvider.js";
import type { LiabilityMap, ComponentLiability } from "../services/liabilityMap.js";

export interface UserAnswer {
  question_id: string;
  component_id: string;
  answer: string;
  external_github_url?: string;
  notes?: string;
}

export interface LiabilityQuestion {
  id: string;
  component_id: string;
  component_label: string;
  question: string;
  suggested_scope: "INTERNAL" | "EXTERNAL";
}

export interface ConversationState {
  repo: string;
  branch?: string;
  created_at: string;
  updated_at: string;
  questions: LiabilityQuestion[];
  answers: UserAnswer[];
}

const CONVERSATION_FILE = "intent_map.json";

export async function loadConversationState(
  contextPath: string
): Promise<ConversationState | null> {
  const p = path.join(contextPath, CONVERSATION_FILE);
  if (!(await fs.pathExists(p))) return null;
  return (await fs.readJson(p)) as ConversationState;
}

export async function saveConversationState(
  contextPath: string,
  state: ConversationState
): Promise<void> {
  const p = path.join(contextPath, CONVERSATION_FILE);
  const now = new Date().toISOString();
  state.updated_at = now;
  if (!state.created_at) state.created_at = now;
  await fs.ensureDir(contextPath);
  await fs.writeJson(p, state, { spaces: 2 });
}

/**
 * Generate liability hotspot questions from static-analysis results.
 * This is where AI adds value by turning tool logs into targeted Q&A.
 */
export async function generateLiabilityQuestionsFromEvidence(opts: {
  contextPath: string;
  repo: string;
  branch?: string;
  evidenceSummary: string; // e.g., summarized Slither/Semgrep findings
  jobId?: number;
}): Promise<LiabilityQuestion[]> {
  const { contextPath, repo, branch, evidenceSummary, jobId } = opts;

  const prompt = `
You are a security auditor configuring an interactive onboarding questionnaire.

You are given a brief summary of static-analysis findings (from tools like Slither, Semgrep, etc.).
Your job is to identify components where liability might be shared or shifted to external systems
(e.g. multisig admin wallets, off-chain oracles, third-party libraries, bridges).

INPUT EVIDENCE:
${evidenceSummary}

OUTPUT STRICT JSON (no markdown, no comments):

{
  "questions": [
    {
      "id": "string-stable-id",
      "component_id": "string-canonical-id",
      "component_label": "human readable label",
      "question": "short direct question",
      "suggested_scope": "INTERNAL" | "EXTERNAL"
    }
  ]
}
`;

  const raw = await executeClaude(prompt, {
    timeout: 4 * 60 * 1000,
    jobId,
    cwd: contextPath,
  });

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // extremely defensive: fall back to empty list
    return [];
  }

  const questions: LiabilityQuestion[] = Array.isArray(parsed.questions)
    ? parsed.questions
    : [];

  // Persist conversation seed
  const state: ConversationState = {
    repo,
    branch,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    questions,
    answers: [],
  };
  await saveConversationState(contextPath, state);

  return questions;
}

/**
 * Apply a user answer to the liability map.
 */
export function applyUserAnswerToLiability(
  answer: UserAnswer,
  existing: LiabilityMap | null
): { component: ComponentLiability; map: LiabilityMap | null } {
  const scope =
    answer.external_github_url && answer.external_github_url.trim().length > 0
      ? "EXTERNAL"
      : "INTERNAL";

  const component: ComponentLiability = {
    id: answer.component_id,
    label: answer.notes || answer.component_id,
    scope,
    notes: answer.answer,
    external_ref: answer.external_github_url
      ? {
          type: "github",
          url: answer.external_github_url,
        }
      : undefined,
  };

  return { component, map: existing };
}

