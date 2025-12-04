# Scan Deployed Contract - Feature Specification

## Overview

This feature allows users to scan already deployed smart contracts on various blockchains by providing the contract address, without needing to connect a GitHub repository.

---

## User Interface

### Input Form
```
┌─────────────────────────────────────────────────┐
│  Enter Contract Address                         │
│  ┌───────────────────────────────────────────┐  │
│  │ 0x1234...abcd                             │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Select Network                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Ethereum Mainnet              ▼           │  │
│  └───────────────────────────────────────────┘  │
│  • Ethereum Mainnet                             │
│  • Polygon                                      │
│  • BSC                                          │
│  • Arbitrum                                     │
│  • Base                                         │
│  • Sepolia (testnet)                            │
│                                                 │
│         [ Scan Contract ]                       │
└─────────────────────────────────────────────────┘
```

---

## Flow Diagram

```
User Input (Address + Network)
         │
         ▼
┌─────────────────────────┐
│ 1. Validate Address     │
│    - Is valid hex?      │
│    - Is contract?       │
│    - (not EOA)          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Fetch Contract Info  │
│    - Etherscan API      │
│    - Get source code    │
│    - Get ABI            │
│    - Get compiler ver   │
└───────────┬─────────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
 Verified?    Not Verified
      │           │
      │           ▼
      │    ┌──────────────┐
      │    │ Decompile    │
      │    │ Bytecode     │
      │    │ (limited)    │
      │    └──────┬───────┘
      │           │
      ▼           ▼
┌─────────────────────────┐
│ 3. Create Temp Project  │
│    - Save .sol files    │
│    - Generate structure │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. Run Audit Pipeline   │
│    - Bootstrap          │
│    - Analysis           │
│    - Report Generation  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. Show Report          │
│    - Findings           │
│    - Score              │
│    - PDF Download       │
└─────────────────────────┘
```

---

## Supported Networks & APIs

| Network | Explorer | API Base URL | Chain ID |
|---------|----------|--------------|----------|
| Ethereum Mainnet | Etherscan | `api.etherscan.io` | 1 |
| Ethereum Sepolia | Etherscan | `api-sepolia.etherscan.io` | 11155111 |
| Polygon | Polygonscan | `api.polygonscan.com` | 137 |
| BSC | BSCScan | `api.bscscan.com` | 56 |
| Arbitrum | Arbiscan | `api.arbiscan.io` | 42161 |
| Base | Basescan | `api.basescan.org` | 8453 |
| Optimism | Optimistic Etherscan | `api-optimistic.etherscan.io` | 10 |

### Alternative Source: Sourcify
- URL: `https://sourcify.dev`
- Multi-chain support
- Open source verified contracts
- Fallback when explorer API fails

---

## API Keys (Environment Variables)

```env
# Block Explorer API Keys
ETHERSCAN_API_KEY=your_key_here
POLYGONSCAN_API_KEY=your_key_here
BSCSCAN_API_KEY=your_key_here
ARBISCAN_API_KEY=4V6PIWUPNM73PIM2THW8U15TDFPRIP8FRI
BASESCAN_API_KEY=your_key_here
OPTIMISM_API_KEY=your_key_here

# Optional: Sourcify (no key required, but rate limited)
SOURCIFY_ENABLED=true
```

---

## Backend API Endpoints

### 1. Validate Address
```
POST /scan/validate
```

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "ethereum"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "isContract": true,
  "isVerified": true,
  "contractName": "MyToken",
  "compiler": "v0.8.19+commit.7dd6d404"
}
```

**Response (Not Verified):**
```json
{
  "valid": true,
  "isContract": true,
  "isVerified": false,
  "bytecodeSize": 4523,
  "warning": "Contract source not verified. Limited analysis available."
}
```

### 2. Fetch Contract Source
```
POST /scan/fetch
```

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "ethereum"
}
```

**Response:**
```json
{
  "success": true,
  "contractName": "MyToken",
  "compiler": "v0.8.19",
  "optimization": true,
  "runs": 200,
  "sources": {
    "contracts/MyToken.sol": "// SPDX-License-Identifier...",
    "contracts/interfaces/IERC20.sol": "// SPDX-License-Identifier..."
  },
  "abi": [...],
  "constructorArguments": "0x..."
}
```

### 3. Enqueue Scan Job
```
POST /scan/enqueue
```

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "ethereum",
  "projectName": "MyToken-0x1234"
}
```

**Response:**
```json
{
  "jobId": 123,
  "project": "MyToken-0x1234",
  "status": "queued"
}
```

### 4. Progress & Report
Same as existing GitHub flow:
- `GET /progress?project=MyToken-0x1234&branch=main`
- `GET /report?project=MyToken-0x1234&branch=main&format=pdf`

---

## Edge Cases & Handling

| Case | Detection | Handling |
|------|-----------|----------|
| **EOA (not contract)** | `eth_getCode` returns `0x` | Error: "Address is not a contract" |
| **Not verified** | Etherscan API returns no source | Warning + bytecode decompile option |
| **Proxy contract** | Detect EIP-1967/EIP-1822 pattern | Fetch implementation contract too |
| **Multiple files** | Source has imports | Maintain file structure |
| **Already scanned** | Check by address hash | Offer cached report or rescan |
| **Rate limited** | API returns 429 | Queue with delay, show status |

---

## Proxy Contract Detection

### Common Proxy Patterns

| Pattern | Storage Slot | Detection |
|---------|--------------|-----------|
| EIP-1967 | `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` | Read slot |
| EIP-1822 (UUPS) | `0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7` | Read slot |
| OpenZeppelin Transparent | Admin slot check | Read admin slot |
| Beacon Proxy | `0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50` | Read beacon |

### Flow for Proxy
```
1. Detect proxy pattern
2. Read implementation address from storage slot
3. Fetch both proxy and implementation source
4. Analyze implementation (actual logic)
5. Note proxy pattern in report
```

---

## Data Flow

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐
│   UI    │────▶│  /scan/*    │────▶│  Etherscan   │
│         │     │   Routes    │     │     API      │
└─────────┘     └──────┬──────┘     └──────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Temp Project  │
              │  ~/.uatu/scans │
              │  /{address}/   │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │  Audit Queue   │
              │  (same as      │
              │   GitHub flow) │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │    Report      │
              └────────────────┘
```

---

## Workspace Structure for Scans

```
~/.uatu/
├── workspace/
│   └── scans/
│       └── {network}/
│           └── {address}/
│               ├── contracts/          # Fetched source files
│               │   ├── MyToken.sol
│               │   └── interfaces/
│               ├── .uatu/
│               │   └── context/
│               ├── runs/
│               │   └── {timestamp}/
│               │       ├── progress.json
│               │       ├── results.json
│               │       └── report.pdf
│               └── metadata.json       # Contract info from explorer
```

---

## Frontend Components

### New Page: `ScanContract.tsx`

```
ui/src/pages/
├── AuditSetup.tsx       (existing - GitHub)
├── ScanContract.tsx     (NEW - deployed contract)
├── ReviewAndRun.tsx     (shared)
├── Reports.tsx          (shared)
└── ReportDetail.tsx     (shared)
```

### Component Structure
```
ScanContract.tsx
├── NetworkSelector      # Dropdown for chain selection
├── AddressInput         # Contract address with validation
├── ContractPreview      # Show contract name, compiler after validate
├── ProxyWarning         # Alert if proxy detected
├── UnverifiedWarning    # Alert if not verified
└── ScanButton           # Start scan
```

---

## Error Messages

| Error Code | Message | User Action |
|------------|---------|-------------|
| `INVALID_ADDRESS` | "Invalid contract address format" | Check address |
| `NOT_CONTRACT` | "Address is an EOA, not a contract" | Use contract address |
| `NOT_VERIFIED` | "Contract source not verified on explorer" | Limited analysis |
| `RATE_LIMITED` | "API rate limit reached. Retry in X seconds" | Wait |
| `NETWORK_ERROR` | "Failed to connect to explorer API" | Check network |
| `PROXY_IMPL_NOT_VERIFIED` | "Proxy detected but implementation not verified" | Limited analysis |

---

## Implementation Checklist

### Backend
- [ ] Create `/scan` routes in `routes/scan.ts`
- [ ] Create `explorerService.ts` for Etherscan/Sourcify API
- [ ] Create `proxyDetector.ts` for proxy pattern detection
- [ ] Add network configuration in `config/networks.ts`
- [ ] Modify `workspaceService.ts` for scan paths
- [ ] Add scan-specific job type in `jobQueue.ts`

### Frontend
- [ ] Create `ScanContract.tsx` page
- [ ] Create `NetworkSelector` component
- [ ] Create `AddressInput` with validation
- [ ] Add route in `App.tsx`
- [ ] Update landing page with both options

### Config
- [ ] Add explorer API keys to `.env.example`
- [ ] Add network config to `config.json`

---

## Security Considerations

1. **Input Validation**: Strictly validate address format (0x + 40 hex chars)
2. **Rate Limiting**: Implement per-user rate limits for scan requests
3. **API Key Protection**: Never expose explorer API keys to frontend
4. **Source Verification**: Don't trust source blindly, verify bytecode matches
5. **Malicious Contracts**: Sandbox analysis, don't execute fetched code

---

*Document Version: 1.0*
*Created: 2024-12-04*
