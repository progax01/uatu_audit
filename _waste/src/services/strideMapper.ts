import { StrideCategory, STRIDE_CATEGORIES } from "./testStyles.js";

export type Stride = StrideCategory;

export interface StrideHintParams {
  functionSig?: string;
  fileText?: string;
  findings?: Array<{ id: string; title: string; severity?: string }>;
  contractName?: string;
  isPayable?: boolean;
  hasModifiers?: string[];
}

export function strideHints(params: StrideHintParams): Set<Stride> {
  const out = new Set<Stride>();
  const s = (params.fileText || "").toLowerCase();
  const f = (params.findings || []).map(x => (x.id + " " + x.title).toLowerCase()).join(" ");
  const func = (params.functionSig || "").toLowerCase();
  const modifiers = (params.hasModifiers || []).map(m => m.toLowerCase());

  // Spoofing (identity/auth)
  if (
    /msg\.sender|onlyowner|accesscontrol|require.*auth|modifier.*only/.test(s) ||
    /tx\.origin/.test(s) ||
    /spoof|impersonat|auth.*bypass/.test(f) ||
    modifiers.some(m => /only|auth|access/.test(m)) ||
    func.includes("owner") ||
    func.includes("admin")
  ) {
    out.add("spoofing");
  }

  // Tampering (unauthorized state change)
  if (
    /mapping|storage|sstore|state.*variable/.test(s) ||
    /tamper|unauthor|mutate.*state/.test(f) ||
    func.includes("set") ||
    func.includes("update") ||
    func.includes("change") ||
    /function.*external|function.*public/.test(s)
  ) {
    out.add("tampering");
  }

  // Repudiation (no audit trail)
  if (
    !/emit\s+\w+/.test(s) || // No events found
    /no event|repudiation|audit.*trail/.test(f) ||
    func.includes("withdraw") ||
    func.includes("transfer") ||
    func.includes("mint") ||
    func.includes("burn")
  ) {
    out.add("repudiation");
  }

  // Info disclosure
  if (
    /event\s+\w*\([^)]*(?:key|secret|salt|priv|seed|mnemonic)/i.test(s) ||
    /info.*disclosure|leak|expose.*sensitive/.test(f) ||
    /console\.log|require.*\.*/i.test(s) ||
    /debug|trace|log.*sensitive/i.test(s)
  ) {
    out.add("info_disclosure");
  }

  // DoS (unbounded loops, reentrancy)
  if (
    /for\s*\([^)]*;\s*[^;]*;\s*[^)]*\)/.test(s) || // for loops
    /while\s*\(/.test(s) ||
    /\.call\s*{/.test(s) ||
    /\.call\(/.test(s) ||
    /reentrancy|dos|gas.*grief|unbounded.*loop/.test(f) ||
    /external.*call|low.*level.*call/.test(s) ||
    params.isPayable ||
    func.includes("batch") ||
    func.includes("multi")
  ) {
    out.add("dos");
  }

  // EoP (privilege escalation, delegatecall, upgrade bypass)
  if (
    /delegatecall|uups|beacon|proxy|upgradeable/i.test(s) ||
    /eop|privilege.*escalat|bypass.*access|admin.*takeover/.test(f) ||
    /selfdestruct|suicide/.test(s) ||
    /assembly\s*{/.test(s) ||
    func.includes("upgrade") ||
    func.includes("initialize") ||
    modifiers.some(m => /initializer|upgradeable/.test(m))
  ) {
    out.add("eop");
  }

  return out;
}

export function strideHintsFromInventory(inventory: any): Map<string, Set<Stride>> {
  const results = new Map<string, Set<Stride>>();
  
  // Process Solidity contracts
  if (inventory.solidity) {
    for (const [contractName, contractData] of Object.entries(inventory.solidity)) {
      const data = contractData as any;
      const functions = data.functions || [];
      const fileText = data.source || "";
      
      for (const functionSig of functions) {
        const key = `${contractName}::${functionSig}`;
        const hints = strideHints({
          functionSig,
          fileText,
          contractName,
          isPayable: functionSig.includes("payable"),
          hasModifiers: data.modifiers || []
        });
        
        if (hints.size > 0) {
          results.set(key, hints);
        }
      }
    }
  }
  
  // Process Anchor programs
  if (inventory.anchor?.fns) {
    for (const [programName, functions] of Object.entries(inventory.anchor.fns)) {
      const functionList = functions as string[];
      for (const functionSig of functionList) {
        const key = `${programName}::${functionSig}`;
        const hints = strideHints({
          functionSig,
          fileText: "", // Would need to read the actual file
          contractName: programName
        });
        
        if (hints.size > 0) {
          results.set(key, hints);
        }
      }
    }
  }
  
  return results;
}

export function strideHintsFromAnalysis(analysis: any, strideMap: Map<string, Set<Stride>>): Map<string, Set<Stride>> {
  const findings = analysis.findings || [];
  
  // Enhance existing hints with analysis findings
  for (const [target, existingHints] of strideMap.entries()) {
    const relevantFindings = findings.filter((f: any) => 
      f.file && target.includes(f.file.split('/').pop()?.split('.')[0] || '')
    );
    
    if (relevantFindings.length > 0) {
      const enhancedHints = strideHints({
        findings: relevantFindings
      });
      
      // Merge with existing hints
      for (const hint of enhancedHints) {
        existingHints.add(hint);
      }
    }
  }
  
  return strideMap;
}

export function generateStrideMatrix(targets: string[], strideMap: Map<string, Set<Stride>>) {
  return targets.map(target => {
    const applicableStride = Array.from(strideMap.get(target) || new Set()) as Stride[];
    const cases = applicableStride.map((category: Stride) => ({
      id: `${category.substring(0, 3)}-${Math.random().toString(36).substring(7)}`,
      category,
      desc: generateStrideTestDescription(target, category)
    }));
    
    return {
      target,
      stride: applicableStride,
      cases
    };
  }).filter(item => item.cases.length > 0);
}

function generateStrideTestDescription(target: string, category: Stride): string {
  const functionName = target.split('::')[1]?.split('(')[0] || 'function';
  
  const templates = {
    spoofing: `Verify ${functionName} prevents identity spoofing and unauthorized access`,
    tampering: `Ensure ${functionName} blocks unauthorized state modifications`,
    repudiation: `Confirm ${functionName} emits appropriate events for audit trail`,
    info_disclosure: `Check ${functionName} doesn't leak sensitive information`,
    dos: `Test ${functionName} resistance to DoS attacks and gas griefing`,
    eop: `Validate ${functionName} prevents privilege escalation`
  };
  
  return templates[category] || `Test ${functionName} for ${category} vulnerabilities`;
}
