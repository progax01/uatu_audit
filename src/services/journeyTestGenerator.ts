import { TestStyle } from "../types.js";
import { ProjectStructure } from "./projectAnalyzer.js";

export type JourneyType = 
  | "defi_lending" | "defi_trading" | "defi_staking" 
  | "nft_marketplace" | "nft_minting" 
  | "dao_governance" | "dao_treasury"
  | "cross_chain" | "layer2_bridge"
  | "oracle_integration" | "flash_loan"
  | "yield_farming" | "liquidity_provision"
  | "token_launch" | "vesting_schedule";

export interface JourneyStep {
  id: string;
  name: string;
  description: string;
  actor: string; // who performs this step
  preconditions: string[];
  actions: string[];
  expectedOutcomes: string[];
  riskFactors: string[];
  testCases: {
    happy: string[];
    negative: string[];
    edge: string[];
  };
}

export interface JourneyTemplate {
  type: JourneyType;
  name: string;
  description: string;
  stakeholders: string[];
  steps: JourneyStep[];
  criticalPaths: string[];
  riskProfile: "low" | "medium" | "high" | "critical";
  estimatedComplexity: number; // 1-10
}

export class JourneyTestGenerator {
  
  static getRecommendedJourneys(projectStructure: ProjectStructure): JourneyType[] {
    const recommendations: JourneyType[] = [];
    
    // Analyze file names and content for journey hints
    const allFiles = [
      ...projectStructure.mainContracts,
      ...projectStructure.testFiles,
      ...projectStructure.configFiles
    ].map(f => f.toLowerCase());
    
    // DeFi patterns
    if (this.hasPattern(allFiles, ['lending', 'borrow', 'collateral', 'liquidat'])) {
      recommendations.push("defi_lending");
    }
    
    if (this.hasPattern(allFiles, ['swap', 'trade', 'dex', 'amm', 'liquidity'])) {
      recommendations.push("defi_trading");
    }
    
    if (this.hasPattern(allFiles, ['stake', 'reward', 'yield', 'farm'])) {
      recommendations.push("defi_staking", "yield_farming");
    }
    
    // NFT patterns
    if (this.hasPattern(allFiles, ['nft', 'erc721', 'erc1155', 'token', 'mint'])) {
      recommendations.push("nft_minting");
    }
    
    if (this.hasPattern(allFiles, ['marketplace', 'auction', 'bid', 'offer'])) {
      recommendations.push("nft_marketplace");
    }
    
    // DAO patterns
    if (this.hasPattern(allFiles, ['govern', 'proposal', 'vote', 'dao'])) {
      recommendations.push("dao_governance");
    }
    
    if (this.hasPattern(allFiles, ['treasury', 'fund', 'multisig'])) {
      recommendations.push("dao_treasury");
    }
    
    // Cross-chain patterns
    if (this.hasPattern(allFiles, ['bridge', 'cross', 'chain', 'relay'])) {
      recommendations.push("cross_chain", "layer2_bridge");
    }
    
    // Oracle patterns
    if (this.hasPattern(allFiles, ['oracle', 'price', 'feed', 'chainlink'])) {
      recommendations.push("oracle_integration");
    }
    
    // Flash loan patterns
    if (this.hasPattern(allFiles, ['flash', 'loan', 'borrow'])) {
      recommendations.push("flash_loan");
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }
  
  private static hasPattern(files: string[], keywords: string[]): boolean {
    return files.some(file => 
      keywords.some(keyword => file.includes(keyword))
    );
  }
  
  static generateJourneyTemplate(type: JourneyType): JourneyTemplate {
    switch (type) {
      case "defi_lending":
        return this.createDeFiLendingJourney();
      case "defi_trading":
        return this.createDeFiTradingJourney();
      case "nft_marketplace":
        return this.createNFTMarketplaceJourney();
      case "dao_governance":
        return this.createDAOGovernanceJourney();
      case "flash_loan":
        return this.createFlashLoanJourney();
      default:
        return this.createGenericJourney(type);
    }
  }
  
  private static createDeFiLendingJourney(): JourneyTemplate {
    return {
      type: "defi_lending",
      name: "DeFi Lending Protocol Journey",
      description: "Complete user journey for lending and borrowing assets in a DeFi protocol",
      stakeholders: ["Lender", "Borrower", "Liquidator", "Protocol Admin"],
      riskProfile: "high",
      estimatedComplexity: 8,
      criticalPaths: [
        "deposit -> borrow -> repay -> withdraw",
        "deposit -> borrow -> liquidation",
        "interest accrual over time"
      ],
      steps: [
        {
          id: "deposit_collateral",
          name: "Deposit Collateral",
          description: "User deposits assets as collateral to enable borrowing",
          actor: "Lender/Borrower",
          preconditions: ["User has sufficient token balance", "Protocol is not paused"],
          actions: ["Approve token transfer", "Call deposit function", "Update user balance"],
          expectedOutcomes: ["Collateral balance increases", "User can now borrow", "Interest starts accruing"],
          riskFactors: ["Reentrancy during deposit", "Price oracle manipulation", "Integer overflow"],
          testCases: {
            happy: ["Deposit valid amount", "Multiple deposits", "Deposit different tokens"],
            negative: ["Deposit zero amount", "Deposit without approval", "Deposit when paused"],
            edge: ["Deposit exact max amount", "Deposit with price at boundary", "Concurrent deposits"]
          }
        },
        {
          id: "borrow_assets",
          name: "Borrow Assets",
          description: "User borrows assets against their collateral",
          actor: "Borrower",
          preconditions: ["Sufficient collateral deposited", "Borrow amount within limits"],
          actions: ["Check collateral ratio", "Calculate borrow limit", "Transfer borrowed assets"],
          expectedOutcomes: ["Borrowed balance increases", "Collateral ratio updated", "Interest starts accruing"],
          riskFactors: ["Insufficient collateral check", "Price oracle failure", "Liquidation threshold breach"],
          testCases: {
            happy: ["Borrow within limit", "Borrow multiple assets", "Partial borrow"],
            negative: ["Borrow more than limit", "Borrow with insufficient collateral", "Borrow non-existent asset"],
            edge: ["Borrow exactly at limit", "Borrow during price volatility", "Borrow with minimum collateral"]
          }
        },
        {
          id: "liquidation",
          name: "Liquidation Process",
          description: "Liquidator liquidates undercollateralized positions",
          actor: "Liquidator",
          preconditions: ["Position is undercollateralized", "Liquidator has repayment tokens"],
          actions: ["Identify liquidatable position", "Repay debt", "Seize collateral"],
          expectedOutcomes: ["Debt reduced", "Collateral transferred", "Liquidation bonus paid"],
          riskFactors: ["Front-running liquidations", "Partial liquidation logic", "Price manipulation"],
          testCases: {
            happy: ["Full liquidation", "Partial liquidation", "Multiple asset liquidation"],
            negative: ["Liquidate healthy position", "Liquidate with insufficient repayment", "Liquidate non-existent position"],
            edge: ["Liquidate at exact threshold", "Liquidate during price update", "Liquidate minimum position"]
          }
        }
      ]
    };
  }
  
  private static createDeFiTradingJourney(): JourneyTemplate {
    return {
      type: "defi_trading",
      name: "DEX Trading Journey",
      description: "User journey for trading assets on a decentralized exchange",
      stakeholders: ["Trader", "Liquidity Provider", "Arbitrageur"],
      riskProfile: "medium",
      estimatedComplexity: 6,
      criticalPaths: [
        "add liquidity -> trade -> remove liquidity",
        "trade -> slippage protection",
        "arbitrage -> MEV protection"
      ],
      steps: [
        {
          id: "add_liquidity",
          name: "Add Liquidity",
          description: "User provides liquidity to earn trading fees",
          actor: "Liquidity Provider",
          preconditions: ["User has both tokens in pair", "Pool exists or can be created"],
          actions: ["Calculate optimal ratio", "Deposit tokens", "Mint LP tokens"],
          expectedOutcomes: ["LP tokens received", "Pool liquidity increases", "User earns fees"],
          riskFactors: ["Impermanent loss", "Front-running", "Price manipulation during deposit"],
          testCases: {
            happy: ["Add liquidity to existing pool", "Create new pool", "Add liquidity in correct ratio"],
            negative: ["Add liquidity with zero amount", "Add liquidity to paused pool", "Add without approval"],
            edge: ["Add liquidity at extreme ratios", "Add minimum liquidity", "Add during high volatility"]
          }
        },
        {
          id: "execute_trade",
          name: "Execute Trade",
          description: "User swaps one token for another",
          actor: "Trader",
          preconditions: ["Sufficient input token balance", "Pool has enough liquidity"],
          actions: ["Calculate output amount", "Check slippage", "Execute swap"],
          expectedOutcomes: ["Tokens swapped", "Pool ratio updated", "Fees distributed"],
          riskFactors: ["Slippage beyond tolerance", "MEV attacks", "Sandwich attacks"],
          testCases: {
            happy: ["Normal swap", "Multi-hop swap", "Exact input swap", "Exact output swap"],
            negative: ["Swap with zero input", "Swap non-existent token", "Swap exceeding balance"],
            edge: ["Swap at maximum slippage", "Swap entire pool", "Swap with deadline"]
          }
        }
      ]
    };
  }
  
  private static createNFTMarketplaceJourney(): JourneyTemplate {
    return {
      type: "nft_marketplace",
      name: "NFT Marketplace Journey",
      description: "Complete NFT trading experience from listing to sale",
      stakeholders: ["Seller", "Buyer", "Platform", "Creator"],
      riskProfile: "medium",
      estimatedComplexity: 5,
      criticalPaths: [
        "mint -> list -> buy -> transfer",
        "auction -> bid -> settle",
        "royalty distribution"
      ],
      steps: [
        {
          id: "list_nft",
          name: "List NFT for Sale",
          description: "Owner lists their NFT on the marketplace",
          actor: "Seller",
          preconditions: ["Owner of NFT", "NFT not already listed", "Marketplace approved"],
          actions: ["Set price and terms", "Create listing", "Transfer NFT to escrow"],
          expectedOutcomes: ["NFT appears in marketplace", "Owner can cancel listing", "Buyers can purchase"],
          riskFactors: ["Price manipulation", "Front-running listings", "Ownership verification"],
          testCases: {
            happy: ["List at fixed price", "List for auction", "List with reserve price"],
            negative: ["List NFT not owned", "List already listed NFT", "List with zero price"],
            edge: ["List at maximum price", "List with minimum duration", "List during ownership transfer"]
          }
        }
      ]
    };
  }
  
  private static createDAOGovernanceJourney(): JourneyTemplate {
    return {
      type: "dao_governance",
      name: "DAO Governance Journey",
      description: "Democratic decision-making process in a DAO",
      stakeholders: ["Token Holder", "Proposer", "Delegate", "Executor"],
      riskProfile: "high",
      estimatedComplexity: 7,
      criticalPaths: [
        "propose -> vote -> execute",
        "delegate -> vote through delegate",
        "emergency governance actions"
      ],
      steps: []
    };
  }
  
  private static createFlashLoanJourney(): JourneyTemplate {
    return {
      type: "flash_loan",
      name: "Flash Loan Journey",
      description: "Atomic flash loan execution and repayment",
      stakeholders: ["Borrower", "Protocol", "Arbitrageur"],
      riskProfile: "critical",
      estimatedComplexity: 9,
      criticalPaths: [
        "borrow -> execute -> repay (atomic)",
        "arbitrage -> profit extraction",
        "failed repayment -> revert"
      ],
      steps: []
    };
  }
  
  private static createGenericJourney(type: JourneyType): JourneyTemplate {
    return {
      type,
      name: `${type.replace(/_/g, ' ')} Journey`,
      description: `Generic journey template for ${type}`,
      stakeholders: ["User", "Admin"],
      riskProfile: "medium",
      estimatedComplexity: 5,
      criticalPaths: ["main user flow"],
      steps: []
    };
  }
  
  static generateJourneyTests(template: JourneyTemplate, testStyle: TestStyle): string[] {
    const tests: string[] = [];
    
    for (const step of template.steps) {
      if (testStyle === "behavioral") {
        tests.push(...this.generateBehavioralJourneyTests(step, template));
      } else if (testStyle === "stride") {
        tests.push(...this.generateStrideJourneyTests(step, template));
      }
    }
    
    // Add end-to-end journey tests
    tests.push(...this.generateE2EJourneyTests(template, testStyle));
    
    return tests;
  }
  
  private static generateBehavioralJourneyTests(step: JourneyStep, template: JourneyTemplate): string[] {
    const tests: string[] = [];
    
    // Happy path tests
    tests.push(`Journey ${template.type} - ${step.name} - Happy Path`);
    tests.push(...step.testCases.happy.map(tc => 
      `Journey ${template.type} - ${step.name} - ${tc}`
    ));
    
    // Negative tests
    tests.push(...step.testCases.negative.map(tc => 
      `Journey ${template.type} - ${step.name} - Negative: ${tc}`
    ));
    
    // Edge cases
    tests.push(...step.testCases.edge.map(tc => 
      `Journey ${template.type} - ${step.name} - Edge: ${tc}`
    ));
    
    return tests;
  }
  
  private static generateStrideJourneyTests(step: JourneyStep, template: JourneyTemplate): string[] {
    const tests: string[] = [];
    
    // STRIDE-based tests for each risk factor
    for (const risk of step.riskFactors) {
      if (risk.toLowerCase().includes('reentrancy')) {
        tests.push(`Journey ${template.type} - ${step.name} - STRIDE Tampering: ${risk}`);
      }
      if (risk.toLowerCase().includes('front') || risk.toLowerCase().includes('mev')) {
        tests.push(`Journey ${template.type} - ${step.name} - STRIDE DoS: ${risk}`);
      }
      if (risk.toLowerCase().includes('access') || risk.toLowerCase().includes('auth')) {
        tests.push(`Journey ${template.type} - ${step.name} - STRIDE Spoofing: ${risk}`);
      }
      if (risk.toLowerCase().includes('event') || risk.toLowerCase().includes('log')) {
        tests.push(`Journey ${template.type} - ${step.name} - STRIDE Repudiation: ${risk}`);
      }
    }
    
    return tests;
  }
  
  private static generateE2EJourneyTests(template: JourneyTemplate, testStyle: TestStyle): string[] {
    const tests: string[] = [];
    
    for (const criticalPath of template.criticalPaths) {
      if (testStyle === "behavioral") {
        tests.push(`Journey ${template.type} - E2E Happy Path: ${criticalPath}`);
        tests.push(`Journey ${template.type} - E2E Failure Recovery: ${criticalPath}`);
      } else if (testStyle === "stride") {
        tests.push(`Journey ${template.type} - E2E Security: ${criticalPath}`);
        tests.push(`Journey ${template.type} - E2E Attack Resistance: ${criticalPath}`);
      }
    }
    
    return tests;
  }
}
