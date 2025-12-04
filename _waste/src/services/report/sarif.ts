import path from "node:path";
import fs from "fs-extra";

type Finding = { id: string; severity: "low"|"medium"|"high"; title: string; file?: string };

export async function writeSarif(runPath: string, findings: Finding[]) {
  const level = (s: Finding["severity"]) => s==="high" ? "error" : s==="medium" ? "warning" : "note";
  const sarif = {
    $schema: "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "UatuAudit", rules: [] as any[] } },
      results: findings.map(f => ({
        ruleId: f.id, level: level(f.severity), message: { text: f.title },
        locations: f.file ? [{ physicalLocation: { artifactLocation: { uri: f.file } } }] : []
      }))
    }]
  } as const;
  const out = path.join(runPath, "findings.sarif");
  await fs.writeJson(out, sarif, { spaces: 2 });
  return out;
}


