import fs from "fs-extra";
import path from "node:path";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'ecosystemDetector' });

export interface EcosystemSignature {
  name: string;
  confidence: number; // 0-1
  evidence: string[];
  mainFiles: string[];
  configFiles: string[];
  dependencies: string[];
}

export interface EcosystemDetectionResult {
  primary: string[];
  secondary: string[];
  signatures: EcosystemSignature[];
  recommendation: string;
}

export class EcosystemDetector {
  
  static async detectEcosystems(projectPath: string): Promise<EcosystemDetectionResult> {
    log.info('Starting ecosystem detection', { projectPath });
    
    const signatures: EcosystemSignature[] = [];
    
    // Detect each ecosystem
    signatures.push(await this.detectFoundry(projectPath));
    signatures.push(await this.detectHardhat(projectPath));
    signatures.push(await this.detectTruffle(projectPath));
    signatures.push(await this.detectAnchor(projectPath));
    signatures.push(await this.detectSoroban(projectPath));
    signatures.push(await this.detectNodeJS(projectPath));
    signatures.push(await this.detectDeno(projectPath));
    signatures.push(await this.detectRust(projectPath));
    signatures.push(await this.detectGo(projectPath));
    
    // Filter out low-confidence detections
    const validSignatures = signatures.filter(s => s.confidence > 0.1);
    
    // Categorize by confidence
    const primary = validSignatures.filter(s => s.confidence >= 0.7).map(s => s.name);
    const secondary = validSignatures.filter(s => s.confidence >= 0.3 && s.confidence < 0.7).map(s => s.name);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(validSignatures);
    
    log.info('Ecosystem detection completed', { 
      primary, 
      secondary, 
      totalSignatures: validSignatures.length 
    });
    
    return {
      primary,
      secondary,
      signatures: validSignatures,
      recommendation
    };
  }
  
  private static async detectFoundry(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    const mainFiles: string[] = [];
    const dependencies: string[] = [];
    let confidence = 0;
    
    // Check for foundry.toml
    const foundryToml = path.join(projectPath, "foundry.toml");
    if (await fs.pathExists(foundryToml)) {
      evidence.push("foundry.toml configuration file");
      configFiles.push("foundry.toml");
      confidence += 0.4;
      
      try {
        const content = await fs.readFile(foundryToml, 'utf8');
        if (content.includes('[profile.')) confidence += 0.1;
        if (content.includes('src =')) confidence += 0.1;
        if (content.includes('test =')) confidence += 0.1;
      } catch {}
    }
    
    // Check for forge-std imports in Solidity files
    const solidityFiles = await this.findFiles(projectPath, /\.sol$/);
    for (const file of solidityFiles.slice(0, 10)) { // Limit check to first 10 files
      try {
        const content = await fs.readFile(file, 'utf8');
        if (content.includes('forge-std/')) {
          evidence.push("forge-std imports in Solidity files");
          mainFiles.push(path.relative(projectPath, file));
          confidence += 0.2;
          break;
        }
      } catch {}
    }
    
    // Check for typical Foundry directory structure
    const srcDir = path.join(projectPath, "src");
    const testDir = path.join(projectPath, "test");
    if (await fs.pathExists(srcDir)) {
      evidence.push("src/ directory");
      confidence += 0.1;
    }
    if (await fs.pathExists(testDir)) {
      evidence.push("test/ directory");
      confidence += 0.1;
    }
    
    // Check for .t.sol test files
    const testFiles = await this.findFiles(projectPath, /\.t\.sol$/);
    if (testFiles.length > 0) {
      evidence.push(`${testFiles.length} Foundry test files (*.t.sol)`);
      confidence += Math.min(0.2, testFiles.length * 0.05);
    }
    
    return {
      name: "foundry",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles,
      configFiles,
      dependencies
    };
  }
  
  private static async detectHardhat(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    const mainFiles: string[] = [];
    const dependencies: string[] = [];
    let confidence = 0;
    
    // Check for hardhat.config.js/ts
    const hardhatConfigs = ["hardhat.config.js", "hardhat.config.ts"];
    for (const config of hardhatConfigs) {
      if (await fs.pathExists(path.join(projectPath, config))) {
        evidence.push(`${config} configuration file`);
        configFiles.push(config);
        confidence += 0.4;
        break;
      }
    }
    
    // Check package.json for Hardhat dependencies
    const packageJson = path.join(projectPath, "package.json");
    if (await fs.pathExists(packageJson)) {
      try {
        const pkg = await fs.readJson(packageJson);
        const allDeps = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})};
        
        if (allDeps.hardhat) {
          evidence.push("hardhat dependency in package.json");
          dependencies.push("hardhat");
          confidence += 0.3;
        }
        
        if (allDeps["@nomiclabs/hardhat-ethers"]) {
          evidence.push("Hardhat ethers plugin");
          dependencies.push("@nomiclabs/hardhat-ethers");
          confidence += 0.1;
        }
      } catch {}
    }
    
    // Check for typical Hardhat test structure
    const testFiles = await this.findFiles(projectPath, /\.(test|spec)\.(js|ts)$/);
    if (testFiles.length > 0) {
      evidence.push(`${testFiles.length} JavaScript/TypeScript test files`);
      confidence += Math.min(0.2, testFiles.length * 0.05);
    }
    
    return {
      name: "hardhat",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles,
      configFiles,
      dependencies
    };
  }
  
  private static async detectTruffle(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const truffleConfig = path.join(projectPath, "truffle-config.js");
    if (await fs.pathExists(truffleConfig)) {
      evidence.push("truffle-config.js");
      configFiles.push("truffle-config.js");
      confidence += 0.5;
    }
    
    const migrationsDir = path.join(projectPath, "migrations");
    if (await fs.pathExists(migrationsDir)) {
      evidence.push("migrations/ directory");
      confidence += 0.2;
    }
    
    return {
      name: "truffle",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async detectAnchor(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const anchorToml = path.join(projectPath, "Anchor.toml");
    if (await fs.pathExists(anchorToml)) {
      evidence.push("Anchor.toml configuration");
      configFiles.push("Anchor.toml");
      confidence += 0.6;
    }
    
    const programsDir = path.join(projectPath, "programs");
    if (await fs.pathExists(programsDir)) {
      evidence.push("programs/ directory");
      confidence += 0.2;
    }
    
    const cargoToml = path.join(projectPath, "Cargo.toml");
    if (await fs.pathExists(cargoToml)) {
      try {
        const content = await fs.readFile(cargoToml, 'utf8');
        if (content.includes('anchor-lang')) {
          evidence.push("anchor-lang dependency");
          confidence += 0.2;
        }
      } catch {}
    }
    
    return {
      name: "anchor",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async detectSoroban(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const cargoToml = path.join(projectPath, "Cargo.toml");
    if (await fs.pathExists(cargoToml)) {
      try {
        const content = await fs.readFile(cargoToml, 'utf8');
        if (content.includes('soroban-sdk')) {
          evidence.push("soroban-sdk dependency");
          configFiles.push("Cargo.toml");
          confidence += 0.6;
        }
      } catch {}
    }
    
    return {
      name: "soroban",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async detectNodeJS(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const packageJson = path.join(projectPath, "package.json");
    if (await fs.pathExists(packageJson)) {
      evidence.push("package.json");
      configFiles.push("package.json");
      confidence += 0.4;
      
      try {
        const pkg = await fs.readJson(packageJson);
        if (pkg.scripts) confidence += 0.1;
        if (pkg.main || pkg.type) confidence += 0.1;
      } catch {}
    }
    
    const nodeModules = path.join(projectPath, "node_modules");
    if (await fs.pathExists(nodeModules)) {
      evidence.push("node_modules/ directory");
      confidence += 0.2;
    }
    
    const jsFiles = await this.findFiles(projectPath, /\.(js|ts)$/);
    if (jsFiles.length > 0) {
      evidence.push(`${jsFiles.length} JavaScript/TypeScript files`);
      confidence += Math.min(0.2, jsFiles.length * 0.02);
    }
    
    return {
      name: "nodejs",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async detectDeno(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const denoJson = path.join(projectPath, "deno.json");
    if (await fs.pathExists(denoJson)) {
      evidence.push("deno.json configuration");
      configFiles.push("deno.json");
      confidence += 0.5;
    }
    
    return {
      name: "deno",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async detectRust(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const cargoToml = path.join(projectPath, "Cargo.toml");
    if (await fs.pathExists(cargoToml)) {
      evidence.push("Cargo.toml");
      configFiles.push("Cargo.toml");
      confidence += 0.4;
    }
    
    const srcDir = path.join(projectPath, "src");
    const libRs = path.join(srcDir, "lib.rs");
    const mainRs = path.join(srcDir, "main.rs");
    
    if (await fs.pathExists(libRs)) {
      evidence.push("src/lib.rs");
      confidence += 0.2;
    }
    if (await fs.pathExists(mainRs)) {
      evidence.push("src/main.rs");
      confidence += 0.2;
    }
    
    return {
      name: "rust",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async detectGo(projectPath: string): Promise<EcosystemSignature> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence = 0;
    
    const goMod = path.join(projectPath, "go.mod");
    if (await fs.pathExists(goMod)) {
      evidence.push("go.mod");
      configFiles.push("go.mod");
      confidence += 0.5;
    }
    
    const goFiles = await this.findFiles(projectPath, /\.go$/);
    if (goFiles.length > 0) {
      evidence.push(`${goFiles.length} Go files`);
      confidence += Math.min(0.3, goFiles.length * 0.05);
    }
    
    return {
      name: "go",
      confidence: Math.min(1, confidence),
      evidence,
      mainFiles: [],
      configFiles,
      dependencies: []
    };
  }
  
  private static async findFiles(dir: string, pattern: RegExp, maxFiles: number = 50): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const traverse = async (currentDir: string, depth: number = 0): Promise<void> => {
        if (depth > 3 || files.length >= maxFiles) return; // Limit depth and total files
        
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common directories to ignore
            if (['node_modules', '.git', 'target', 'dist', 'build'].includes(entry.name)) {
              continue;
            }
            await traverse(fullPath, depth + 1);
          } else if (entry.isFile() && pattern.test(entry.name)) {
            files.push(fullPath);
          }
        }
      };
      
      await traverse(dir);
    } catch (error) {
      log.debug('Error traversing directory', { dir, error: String(error) });
    }
    
    return files;
  }
  
  private static generateRecommendation(signatures: EcosystemSignature[]): string {
    if (signatures.length === 0) {
      return "No clear ecosystem detected. Manual configuration recommended.";
    }
    
    const highConfidence = signatures.filter(s => s.confidence >= 0.7);
    
    if (highConfidence.length === 1) {
      return `Strong ${highConfidence[0].name} project detected. Recommend using ${highConfidence[0].name} toolchain.`;
    }
    
    if (highConfidence.length > 1) {
      return `Multi-ecosystem project detected: ${highConfidence.map(s => s.name).join(', ')}. Consider separate audit configurations.`;
    }
    
    const topSignature = signatures.sort((a, b) => b.confidence - a.confidence)[0];
    return `Likely ${topSignature.name} project (${Math.round(topSignature.confidence * 100)}% confidence). Verify configuration manually.`;
  }
}
