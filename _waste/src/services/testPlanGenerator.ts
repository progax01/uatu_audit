import { TestStyle } from "../types.js";
import { BEHAVIORAL_CASES, BehavioralCase } from "./testStyles.js";
import { strideHintsFromInventory, strideHintsFromAnalysis, generateStrideMatrix, Stride } from "./strideMapper.js";

export interface TestPlan {
  style: TestStyle;
  matrix: TestTarget[];
  metadata: {
    generated: string;
    totalTargets: number;
    totalCases: number;
  };
}

export interface TestTarget {
  target: string;
  cases?: BehavioralTestCase[];
  stride?: Stride[];
  strideCase?: StrideTestCase[];
}

export interface BehavioralTestCase {
  id: string;
  kind: BehavioralCase;
  desc: string;
}

export interface StrideTestCase {
  id: string;
  category: Stride;
  desc: string;
}

export class TestPlanGenerator {
  
  static generateBehavioralPlan(inventory: any): TestPlan {
    const targets = this.extractTargetsFromInventory(inventory);
    const matrix = targets.map(target => ({
      target,
      cases: this.generateBehavioralCases(target)
    }));

    return {
      style: "behavioral",
      matrix,
      metadata: {
        generated: new Date().toISOString(),
        totalTargets: matrix.length,
        totalCases: matrix.reduce((sum, t) => sum + (t.cases?.length || 0), 0)
      }
    };
  }

  static generateStridePlan(inventory: any, analysis?: any): TestPlan {
    const targets = this.extractTargetsFromInventory(inventory);
    let strideMap = strideHintsFromInventory(inventory);
    
    if (analysis) {
      strideMap = strideHintsFromAnalysis(analysis, strideMap);
    }
    
    const matrix = generateStrideMatrix(targets, strideMap).map(item => ({
      target: item.target,
      stride: item.stride as Stride[],
      strideCase: item.cases
    }));

    return {
      style: "stride",
      matrix,
      metadata: {
        generated: new Date().toISOString(),
        totalTargets: matrix.length,
        totalCases: matrix.reduce((sum, t) => sum + (t.strideCase?.length || 0), 0)
      }
    };
  }

  private static extractTargetsFromInventory(inventory: any): string[] {
    const targets: string[] = [];
    
    // Extract Solidity targets
    if (inventory.solidity) {
      for (const [contractName, contractData] of Object.entries(inventory.solidity)) {
        const data = contractData as any;
        const functions = data.functions || [];
        
        for (const functionSig of functions) {
          // Only include public/external functions
          if (functionSig.includes('external') || functionSig.includes('public')) {
            targets.push(`contracts/${contractName}.sol::${functionSig}`);
          }
        }
      }
    }
    
    // Extract Anchor targets
    if (inventory.anchor?.fns) {
      for (const [programName, functions] of Object.entries(inventory.anchor.fns)) {
        const functionList = functions as string[];
        for (const functionSig of functionList) {
          targets.push(`programs/${programName}::${functionSig}`);
        }
      }
    }
    
    // Extract Soroban targets
    if (inventory.soroban?.files) {
      for (const file of inventory.soroban.files) {
        const functions = file.functions || [];
        for (const functionSig of functions) {
          targets.push(`soroban/${file.name}::${functionSig}`);
        }
      }
    }
    
    // Extract Node.js targets
    if (inventory.node?.files) {
      for (const file of inventory.node.files) {
        const exports = file.exports || [];
        for (const exportSig of exports) {
          targets.push(`src/${file.name}::${exportSig}`);
        }
      }
    }
    
    return targets;
  }

  private static generateBehavioralCases(target: string): BehavioralTestCase[] {
    const functionName = target.split('::')[1]?.split('(')[0] || 'function';
    const contractName = target.split('/').pop()?.split('.')[0] || 'contract';
    
    return [
      {
        id: `happy-${Math.random().toString(36).substring(7)}`,
        kind: "happy",
        desc: `${functionName} executes successfully with valid inputs and authorization`
      },
      {
        id: `neg-${Math.random().toString(36).substring(7)}`,
        kind: "negative", 
        desc: `${functionName} reverts appropriately with invalid inputs or unauthorized access`
      },
      {
        id: `sad-${Math.random().toString(36).substring(7)}`,
        kind: "sad",
        desc: `${functionName} handles unfavorable conditions gracefully (paused, insufficient funds, etc.)`
      },
      {
        id: `neu-${Math.random().toString(36).substring(7)}`,
        kind: "neutral",
        desc: `${functionName} maintains invariants and handles no-op scenarios correctly`
      }
    ];
  }

  static calculateCoverage(plans: TestPlan[], inventory: any): {
    behavioral: number;
    stride: number;
    uncovered: {
      behavioral?: string[];
      stride?: Stride[];
    };
  } {
    const allTargets = this.extractTargetsFromInventory(inventory);
    const totalTargets = allTargets.length;
    
    if (totalTargets === 0) {
      return { behavioral: 0, stride: 0, uncovered: {} };
    }
    
    const behavioralPlan = plans.find(p => p.style === "behavioral");
    const stridePlan = plans.find(p => p.style === "stride");
    
    // Calculate behavioral coverage
    const behavioralTargetsWithFullCoverage = behavioralPlan?.matrix.filter(t => 
      t.cases && t.cases.length >= 4 // All H/N/S/N cases
    ).length || 0;
    
    const behavioralCoverage = behavioralTargetsWithFullCoverage / totalTargets;
    
    // Calculate STRIDE coverage  
    const strideTargetsWithCoverage = stridePlan?.matrix.length || 0;
    const strideCoverage = strideTargetsWithCoverage / totalTargets;
    
    // Find uncovered areas
    const behavioralUncovered = allTargets.filter(target =>
      !behavioralPlan?.matrix.some(t => t.target === target && t.cases && t.cases.length >= 4)
    );
    
    const strideUncovered = allTargets.filter(target =>
      !stridePlan?.matrix.some(t => t.target === target)
    );
    
    return {
      behavioral: Math.round(behavioralCoverage * 100) / 100,
      stride: Math.round(strideCoverage * 100) / 100,
      uncovered: {
        behavioral: behavioralUncovered.length > 0 ? behavioralUncovered : undefined,
        stride: strideUncovered.length > 0 ? strideUncovered.map(() => "uncovered" as Stride) : undefined
      }
    };
  }
}
