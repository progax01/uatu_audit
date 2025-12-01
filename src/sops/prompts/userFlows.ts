import path from "node:path";

/**
 * Session 3: User Flow Mapping Prompt
 * Maps typical user journeys through the contracts
 */
export function buildUserFlowsPrompt(contextPath: string): string {
  return `You are UatuAudit assistant for USER FLOW ANALYSIS.

## YOUR TASK
Map typical user journeys through the smart contracts. Output results as JSON.

## STEP 1: Read Context

Read \`${path.join(contextPath, "files_structure.md")}\` to understand contracts and their interactions.

## STEP 2: Identify User Flows

Analyze the contracts and identify typical user journeys. For each flow:

### Flow Components
- **id**: Unique identifier (e.g., "flow-001")
- **name**: Flow name (e.g., "Stake Tokens")
- **description**: What the flow accomplishes (1-2 sentences)
- **actor**: Who performs this flow (User, Admin, Contract, etc.)

### Flow Steps
For each step in the journey:
- **step**: Step number (1, 2, 3...)
- **actor**: Who performs this action
- **action**: Function call or transaction (e.g., "approve(stakingContract, amount)")
- **contract**: Which contract is called
- **state_change**: What state changes occur
- **result**: Expected outcome
- **preconditions**: What must be true before this step
- **postconditions**: What becomes true after this step

### Flow Metadata
- **critical**: Is this a critical path? (true/false)
- **integration_points**: List of contracts involved
- **security_considerations**: Potential risks in this flow
- **gas_estimate**: Approximate gas cost

## STEP 3: Common Flow Types to Document

### Standard Flows
1. **Deposit/Stake Flow** - User deposits assets
2. **Withdraw/Unstake Flow** - User withdraws assets
3. **Claim Rewards Flow** - User claims earned rewards
4. **Admin Management Flow** - Admin configures system
5. **Emergency Flow** - Emergency shutdown/recovery

### Integration Flows
6. **Cross-Contract Flow** - Multiple contracts interaction
7. **Approval Flow** - Token approval + usage
8. **Oracle Flow** - Price feed integration

### Edge Case Flows
9. **Failed Transaction Flow** - What happens on revert
10. **Race Condition Flow** - Concurrent user actions

## STEP 4: Write Results

IMPORTANT: Output ONLY the following JSON (no markdown, no explanations, just the JSON):

\`\`\`json
{
  "user_flows": [
    {
      "id": "flow-001",
      "name": "Stake Tokens",
      "description": "User stakes tokens to earn rewards over time",
      "actor": "Token Holder",
      "steps": [
        {
          "step": 1,
          "actor": "Token Holder",
          "action": "approve(stakingContract, amount)",
          "contract": "Token.sol",
          "state_change": "allowance[user][stakingContract] = amount",
          "result": "Approval granted",
          "preconditions": ["User has token balance >= amount"],
          "postconditions": ["Staking contract can transfer user's tokens"]
        },
        {
          "step": 2,
          "actor": "Token Holder",
          "action": "stake(amount)",
          "contract": "Staking.sol",
          "state_change": "stakedBalance[user] += amount, totalStaked += amount",
          "result": "Tokens staked successfully",
          "preconditions": ["Approval exists", "Contract not paused"],
          "postconditions": ["User earns rewards", "Tokens locked in contract"]
        },
        {
          "step": 3,
          "actor": "System",
          "action": "accrue rewards over time",
          "contract": "Staking.sol",
          "state_change": "pendingRewards[user] increases",
          "result": "Rewards accumulate",
          "preconditions": ["User has staked tokens"],
          "postconditions": ["User can claim rewards"]
        }
      ],
      "critical": true,
      "integration_points": ["Token.sol", "Staking.sol"],
      "security_considerations": [
        "Reentrancy risk if tokens make callbacks",
        "Integer overflow in reward calculation",
        "Front-running stake transactions"
      ],
      "gas_estimate": "~150,000 gas"
    },
    {
      "id": "flow-002",
      "name": "Unstake and Claim",
      "description": "User unstakes tokens and claims accumulated rewards",
      "actor": "Token Holder",
      "steps": [
        {
          "step": 1,
          "actor": "Token Holder",
          "action": "unstake(amount)",
          "contract": "Staking.sol",
          "state_change": "stakedBalance[user] -= amount, totalStaked -= amount",
          "result": "Tokens returned to user",
          "preconditions": ["User has staked balance >= amount", "No lock period active"],
          "postconditions": ["User receives tokens", "Rewards still claimable"]
        },
        {
          "step": 2,
          "actor": "Token Holder",
          "action": "claimRewards()",
          "contract": "Staking.sol",
          "state_change": "pendingRewards[user] = 0",
          "result": "Rewards sent to user",
          "preconditions": ["User has pending rewards > 0"],
          "postconditions": ["Reward tokens in user wallet"]
        }
      ],
      "critical": true,
      "integration_points": ["Token.sol", "Staking.sol", "RewardToken.sol"],
      "security_considerations": [
        "Reentrancy during token transfers",
        "Reward calculation accuracy",
        "Lock period bypass attempts"
      ],
      "gas_estimate": "~200,000 gas"
    }
  ]
}
\`\`\`

## GUIDELINES

- Focus on realistic user scenarios
- Include both happy paths and edge cases
- Show contract interactions clearly
- Identify security risks in flows
- Consider gas costs
- Note integration dependencies
- Highlight critical paths

## BEGIN USER FLOW MAPPING NOW

Analyze the contracts and document the main user journeys.`;
}
