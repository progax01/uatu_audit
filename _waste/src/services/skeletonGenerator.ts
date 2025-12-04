import path from "node:path";
import fs from "fs-extra";
import { TestPlan, BehavioralTestCase, StrideTestCase } from "./testPlanGenerator.js";
import { STRIDE_CATEGORIES } from "./testStyles.js";

export class SkeletonGenerator {
  
  static async writeFoundrySkeletons(plan: TestPlan, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    
    for (const target of plan.matrix) {
      const contractName = this.extractContractName(target.target);
      const functionName = this.extractFunctionName(target.target);
      
      if (!contractName || !functionName) continue;
      
      let content: string;
      let fileName: string;
      
      if (plan.style === "behavioral" && target.cases) {
        fileName = `behavioral_${contractName}_${functionName}.t.sol`;
        content = this.generateFoundryBehavioralSkeleton(contractName, functionName, target.cases);
      } else if (plan.style === "stride" && target.strideCase) {
        fileName = `stride_${contractName}_${functionName}.t.sol`;
        content = this.generateFoundryStrideSkeleton(contractName, functionName, target.strideCase);
      } else {
        continue;
      }
      
      const filePath = path.join(outputDir, fileName);
      await fs.ensureDir(outputDir);
      await fs.writeFile(filePath, content);
      files.push(filePath);
    }
    
    return files;
  }

  static async writeHardhatSkeletons(plan: TestPlan, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    
    for (const target of plan.matrix) {
      const contractName = this.extractContractName(target.target);
      const functionName = this.extractFunctionName(target.target);
      
      if (!contractName || !functionName) continue;
      
      let content: string;
      let fileName: string;
      
      if (plan.style === "behavioral" && target.cases) {
        fileName = `behavioral_${contractName}_${functionName}.spec.ts`;
        content = this.generateHardhatBehavioralSkeleton(contractName, functionName, target.cases);
      } else if (plan.style === "stride" && target.strideCase) {
        fileName = `stride_${contractName}_${functionName}.spec.ts`;
        content = this.generateHardhatStrideSkeleton(contractName, functionName, target.strideCase);
      } else {
        continue;
      }
      
      const filePath = path.join(outputDir, fileName);
      await fs.ensureDir(outputDir);
      await fs.writeFile(filePath, content);
      files.push(filePath);
    }
    
    return files;
  }

  static async writeAnchorSkeletons(plan: TestPlan, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    
    for (const target of plan.matrix) {
      const programName = this.extractContractName(target.target);
      const functionName = this.extractFunctionName(target.target);
      
      if (!programName || !functionName) continue;
      
      let content: string;
      let fileName: string;
      
      if (plan.style === "behavioral" && target.cases) {
        fileName = `behavioral_${programName}_${functionName}.rs`;
        content = this.generateAnchorBehavioralSkeleton(programName, functionName, target.cases);
      } else if (plan.style === "stride" && target.strideCase) {
        fileName = `stride_${programName}_${functionName}.rs`;
        content = this.generateAnchorStrideSkeleton(programName, functionName, target.strideCase);
      } else {
        continue;
      }
      
      const filePath = path.join(outputDir, fileName);
      await fs.ensureDir(outputDir);
      await fs.writeFile(filePath, content);
      files.push(filePath);
    }
    
    return files;
  }

  private static extractContractName(target: string): string | null {
    const match = target.match(/\/([^/]+)\.sol::|\/([^/]+)::/);
    return match ? (match[1] || match[2]) : null;
  }

  private static extractFunctionName(target: string): string | null {
    const match = target.match(/::(\w+)/);
    return match ? match[1] : null;
  }

  private static generateFoundryBehavioralSkeleton(contractName: string, functionName: string, cases: BehavioralTestCase[]): string {
    const testFunctions = cases.map(testCase => `
    function test_${testCase.kind}_${functionName}_${testCase.id.split('-')[1]}() public {
        // ${testCase.desc}
        
        // Arrange
        ${this.getBehavioralArrangeCode(testCase.kind, contractName, functionName)}
        
        // Act & Assert
        ${this.getBehavioralActAssertCode(testCase.kind, functionName)}
    }`).join('\n');

    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";

contract ${contractName}BehavioralTest is Test {
    ${contractName} ${contractName.toLowerCase()};
    address owner = address(0xA11CE);
    address user = address(0xB0B);
    address attacker = address(0xBAD);

    function setUp() public {
        vm.prank(owner);
        ${contractName.toLowerCase()} = new ${contractName}();
        // Additional setup as needed
    }
${testFunctions}
}`;
  }

  private static generateFoundryStrideSkeleton(contractName: string, functionName: string, cases: StrideTestCase[]): string {
    const testFunctions = cases.map(testCase => `
    function test_stride_${testCase.category}_${functionName}_${testCase.id.split('-')[1]}() public {
        // ${STRIDE_CATEGORIES[testCase.category].label}: ${testCase.desc}
        
        ${this.getStrideTestCode(testCase.category, contractName, functionName)}
    }`).join('\n');

    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/${contractName}.sol";

contract ${contractName}StrideTest is Test {
    ${contractName} ${contractName.toLowerCase()};
    address owner = address(0xA11CE);
    address user = address(0xB0B);
    address attacker = address(0xBAD);

    function setUp() public {
        vm.prank(owner);
        ${contractName.toLowerCase()} = new ${contractName}();
        // Additional setup as needed
    }
${testFunctions}
}`;
  }

  private static generateHardhatBehavioralSkeleton(contractName: string, functionName: string, cases: BehavioralTestCase[]): string {
    const testCases = cases.map(testCase => `
    it("${testCase.kind}: ${testCase.desc}", async function () {
      // Arrange
      ${this.getBehavioralArrangeCodeJS(testCase.kind)}
      
      // Act & Assert
      ${this.getBehavioralActAssertCodeJS(testCase.kind, functionName)}
    });`).join('\n');

    return `import { expect } from "chai";
import { ethers } from "hardhat";
import { ${contractName} } from "../typechain-types";

describe("${contractName} Behavioral Tests", function () {
  let ${contractName.toLowerCase()}: ${contractName};
  let owner: any;
  let user: any;
  let attacker: any;

  beforeEach(async function () {
    [owner, user, attacker] = await ethers.getSigners();
    
    const ${contractName}Factory = await ethers.getContractFactory("${contractName}");
    ${contractName.toLowerCase()} = await ${contractName}Factory.connect(owner).deploy();
    await ${contractName.toLowerCase()}.deployed();
    
    // Additional setup as needed
  });
${testCases}
});`;
  }

  private static generateHardhatStrideSkeleton(contractName: string, functionName: string, cases: StrideTestCase[]): string {
    const testCases = cases.map(testCase => `
    it("STRIDE ${testCase.category}: ${testCase.desc}", async function () {
      ${this.getStrideTestCodeJS(testCase.category, functionName)}
    });`).join('\n');

    return `import { expect } from "chai";
import { ethers } from "hardhat";
import { ${contractName} } from "../typechain-types";

describe("${contractName} STRIDE Tests", function () {
  let ${contractName.toLowerCase()}: ${contractName};
  let owner: any;
  let user: any;
  let attacker: any;

  beforeEach(async function () {
    [owner, user, attacker] = await ethers.getSigners();
    
    const ${contractName}Factory = await ethers.getContractFactory("${contractName}");
    ${contractName.toLowerCase()} = await ${contractName}Factory.connect(owner).deploy();
    await ${contractName.toLowerCase()}.deployed();
  });
${testCases}
});`;
  }

  private static generateAnchorBehavioralSkeleton(programName: string, functionName: string, cases: BehavioralTestCase[]): string {
    const testFunctions = cases.map(testCase => `
    #[tokio::test]
    async fn test_${testCase.kind}_${functionName}_${testCase.id.split('-')[1]}() {
        // ${testCase.desc}
        
        let mut context = ProgramTestContext::new().await;
        let program_id = ${programName}::id();
        
        // Setup test accounts and context
        ${this.getBehavioralSetupRust(testCase.kind)}
        
        // Execute test
        ${this.getBehavioralExecuteRust(testCase.kind, functionName)}
    }`).join('\n');

    return `use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use solana_program_test::*;
use solana_sdk::{
    signature::{Keypair, Signer},
    transaction::Transaction,
    transport::TransportError,
};

mod common;
use common::*;

#[tokio::test]
async fn setup() {
    // Common setup for all tests
}
${testFunctions}`;
  }

  private static generateAnchorStrideSkeleton(programName: string, functionName: string, cases: StrideTestCase[]): string {
    const testFunctions = cases.map(testCase => `
    #[tokio::test]
    async fn test_stride_${testCase.category}_${functionName}_${testCase.id.split('-')[1]}() {
        // ${STRIDE_CATEGORIES[testCase.category].label}: ${testCase.desc}
        
        let mut context = ProgramTestContext::new().await;
        let program_id = ${programName}::id();
        
        ${this.getStrideTestRust(testCase.category, functionName)}
    }`).join('\n');

    return `use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use solana_program_test::*;
use solana_sdk::{
    signature::{Keypair, Signer},
    transaction::Transaction,
    transport::TransportError,
};

mod common;
use common::*;
${testFunctions}`;
  }

  // Helper methods for generating test code snippets
  private static getBehavioralArrangeCode(kind: string, contractName: string, functionName: string): string {
    switch (kind) {
      case "happy":
        return `// Set up valid conditions for ${functionName}`;
      case "negative":
        return `// Set up conditions that should cause ${functionName} to revert
        vm.prank(attacker);`;
      case "sad":
        return `// Set up unfavorable but legitimate conditions
        // e.g., pause the contract, deplete funds, etc.`;
      case "neutral":
        return `// Set up neutral conditions for no-op test`;
      default:
        return `// Set up test conditions`;
    }
  }

  private static getBehavioralActAssertCode(kind: string, functionName: string): string {
    switch (kind) {
      case "happy":
        return `// Call ${functionName} and assert success
        // contract.${functionName}();
        // assertEq(expectedValue, actualValue);`;
      case "negative":
        return `vm.expectRevert();
        // contract.${functionName}();`;
      case "sad":
        return `vm.expectRevert();
        // contract.${functionName}();`;
      case "neutral":
        return `// Call ${functionName} and assert no state change
        // uint256 stateBefore = getState();
        // contract.${functionName}();
        // assertEq(stateBefore, getState());`;
      default:
        return `// Act and assert`;
    }
  }

  private static getBehavioralArrangeCodeJS(kind: string): string {
    switch (kind) {
      case "happy":
        return `// Set up valid conditions`;
      case "negative":
        return `// Set up conditions that should cause reversion`;
      case "sad":
        return `// Set up unfavorable but legitimate conditions`;
      case "neutral":
        return `// Set up neutral conditions for no-op test`;
      default:
        return `// Set up test conditions`;
    }
  }

  private static getBehavioralActAssertCodeJS(kind: string, functionName: string): string {
    switch (kind) {
      case "happy":
        return `// await expect(contract.${functionName}()).to.not.be.reverted;`;
      case "negative":
        return `// await expect(contract.${functionName}()).to.be.reverted;`;
      case "sad":
        return `// await expect(contract.${functionName}()).to.be.reverted;`;
      case "neutral":
        return `// const stateBefore = await getState();
        // await contract.${functionName}();
        // expect(await getState()).to.equal(stateBefore);`;
      default:
        return `// Act and assert`;
    }
  }

  private static getStrideTestCode(category: string, contractName: string, functionName: string): string {
    switch (category) {
      case "spoofing":
        return `vm.startPrank(attacker);
        vm.expectRevert();
        // ${contractName.toLowerCase()}.${functionName}();
        vm.stopPrank();`;
      case "tampering":
        return `vm.prank(attacker);
        vm.expectRevert();
        // Attempt unauthorized state modification`;
      case "repudiation":
        return `vm.expectEmit(true, true, true, true);
        // emit ExpectedEvent(...);
        // ${contractName.toLowerCase()}.${functionName}();`;
      case "info_disclosure":
        return `// Execute function and check logs for sensitive data
        // vm.recordLogs();
        // ${contractName.toLowerCase()}.${functionName}();
        // Vm.Log[] memory logs = vm.getRecordedLogs();
        // Assert no sensitive data in logs`;
      case "dos":
        return `// Test for DoS resistance
        // uint256 gasBefore = gasleft();
        // ${contractName.toLowerCase()}.${functionName}();
        // assertLt(gasBefore - gasleft(), MAX_GAS_USAGE);`;
      case "eop":
        return `vm.prank(attacker);
        vm.expectRevert();
        // Attempt privilege escalation`;
      default:
        return `// STRIDE test implementation needed`;
    }
  }

  private static getStrideTestCodeJS(category: string, functionName: string): string {
    switch (category) {
      case "spoofing":
        return `// await expect(contract.connect(attacker).${functionName}()).to.be.reverted;`;
      case "tampering":
        return `// Attempt unauthorized state modification
        // await expect(contract.connect(attacker).${functionName}()).to.be.reverted;`;
      case "repudiation":
        return `// await expect(contract.${functionName}()).to.emit(contract, 'ExpectedEvent');`;
      case "info_disclosure":
        return `// Check that no sensitive information is exposed in events or return values`;
      case "dos":
        return `// Test for DoS resistance - measure gas usage, test with large inputs`;
      case "eop":
        return `// Attempt privilege escalation
        // await expect(contract.connect(attacker).${functionName}()).to.be.reverted;`;
      default:
        return `// STRIDE test implementation needed`;
    }
  }

  private static getBehavioralSetupRust(kind: string): string {
    return `// Setup for ${kind} test case`;
  }

  private static getBehavioralExecuteRust(kind: string, functionName: string): string {
    return `// Execute ${functionName} for ${kind} case`;
  }

  private static getStrideTestRust(category: string, functionName: string): string {
    return `// STRIDE ${category} test for ${functionName}`;
  }
}
