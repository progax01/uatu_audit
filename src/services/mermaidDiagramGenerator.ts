import type { UserFlow, UserFlowNode } from './userFlowAnalyzer.js';

export interface MermaidDiagram {
  flowId: string;
  diagramType: 'flowchart' | 'stateDiagram' | 'sequenceDiagram';
  mermaidCode: string;
  description: string;
  svgData?: string; // Optional rendered SVG for reports
}

/**
 * Generate Mermaid flowchart for a user flow
 * Shows the complete flow with security annotations
 */
export function generateFlowchartForUserFlow(flow: UserFlow): MermaidDiagram {
  let mermaid = 'flowchart TD\n';

  // Entry point
  mermaid += `  START([👤 User Entry: ${flow.entryPoint.functionName}])\n`;
  mermaid += `  START -->|"Visibility: ${flow.entryPoint.visibility}"| ENTRY\n`;

  const entryModifiers = flow.entryPoint.modifiers.length > 0
    ? `Modifiers: ${flow.entryPoint.modifiers.join(', ')}`
    : 'No modifiers';
  mermaid += `  ENTRY["📍 ${flow.entryPoint.functionName}()\\n${entryModifiers}"]\n`;

  // Process each step in the flow
  flow.steps.forEach((step, idx) => {
    if (idx === 0) return; // Skip entry (already handled)

    const nodeId = `STEP${idx}`;
    const prevNodeId = idx === 1 ? 'ENTRY' : `STEP${idx - 1}`;

    // Determine node styling based on security characteristics
    if (step.requiredRole) {
      mermaid += `  ${nodeId}["🔒 ${step.functionName}()\\nRole: ${step.requiredRole}"]:::privileged\n`;
    } else if (step.externalCalls.length > 0) {
      const externalList = step.externalCalls.slice(0, 2).join(', ');
      const more = step.externalCalls.length > 2 ? `, +${step.externalCalls.length - 2} more` : '';
      mermaid += `  ${nodeId}["⚠️ ${step.functionName}()\\nExternal: ${externalList}${more}"]:::external\n`;
    } else if (step.stateChanges.length > 0) {
      mermaid += `  ${nodeId}["💾 ${step.functionName}()\\nState: ${step.stateChanges.length} changes"]:::stateChange\n`;
    } else {
      mermaid += `  ${nodeId}["${step.functionName}()"]\n`;
    }

    // Add edge with state change information
    if (step.stateChanges.length > 0) {
      const stateInfo = step.stateChanges.slice(0, 2).join(', ');
      const more = step.stateChanges.length > 2 ? '...' : '';
      mermaid += `  ${prevNodeId} -->|"Updates: ${stateInfo}${more}"| ${nodeId}\n`;
    } else {
      mermaid += `  ${prevNodeId} --> ${nodeId}\n`;
    }

    // Add event emissions as notes
    if (step.events.length > 0) {
      mermaid += `  Note right of ${nodeId}: Events: ${step.events.join(', ')}\n`;
    }
  });

  // End node
  const lastNodeId = flow.steps.length > 1 ? `STEP${flow.steps.length - 1}` : 'ENTRY';
  mermaid += `  ${lastNodeId} --> END([✅ Complete])\n`;

  // Styling classes
  mermaid += `\n  classDef privileged fill:#ff6b6b,stroke:#c92a2a,color:#fff,stroke-width:3px\n`;
  mermaid += `  classDef external fill:#ffd43b,stroke:#fab005,color:#000,stroke-width:2px\n`;
  mermaid += `  classDef stateChange fill:#74c0fc,stroke:#1c7ed6,color:#000,stroke-width:2px\n`;

  // Add risks as comments
  if (flow.risks.length > 0) {
    mermaid += `\n  %% ⚠️ IDENTIFIED RISKS:\n`;
    flow.risks.forEach((risk, idx) => {
      mermaid += `  %% ${idx + 1}. ${risk}\n`;
    });
  }

  return {
    flowId: flow.id,
    diagramType: 'flowchart',
    mermaidCode: mermaid,
    description: `${flow.name}: ${flow.description}`
  };
}

/**
 * Generate state diagram showing state variable transitions
 * Useful for understanding contract state lifecycle
 */
export function generateStateDiagramForFlow(flow: UserFlow): MermaidDiagram {
  let mermaid = 'stateDiagram-v2\n';

  // Collect all unique state changes
  const stateTransitions = new Map<string, Set<string>>();

  flow.steps.forEach(step => {
    step.stateChanges.forEach(state => {
      if (!stateTransitions.has(state)) {
        stateTransitions.set(state, new Set());
      }
      // Track which function modifies this state
      stateTransitions.get(state)!.add(step.functionName);
    });
  });

  if (stateTransitions.size > 0) {
    mermaid += '  [*] --> Initial\n';

    stateTransitions.forEach((functions, stateName) => {
      const sanitized = stateName.replace(/[^a-zA-Z0-9_]/g, '_');
      const functionList = Array.from(functions).join(', ');

      mermaid += `  Initial --> ${sanitized}: ${functionList}\n`;
      mermaid += `  ${sanitized} --> Modified: update\n`;
      mermaid += `  Modified --> [*]\n`;

      // Add note about which functions modify this state
      mermaid += `  note right of ${sanitized}\n`;
      mermaid += `    Modified by:\n`;
      mermaid += `    ${functionList}\n`;
      mermaid += `  end note\n`;
    });
  } else {
    mermaid += '  [*] --> NoStateChanges\n';
    mermaid += '  NoStateChanges --> [*]\n';
  }

  return {
    flowId: flow.id,
    diagramType: 'stateDiagram',
    mermaidCode: mermaid,
    description: `State transitions for ${flow.name}`
  };
}

/**
 * Generate sequence diagram showing actor interactions
 * Great for visualizing who calls what and when
 */
export function generateSequenceDiagramForFlow(flow: UserFlow): MermaidDiagram {
  let mermaid = 'sequenceDiagram\n';

  // Define participants
  mermaid += '  participant User\n';
  mermaid += `  participant ${flow.entryPoint.contractName || 'Contract'}\n`;

  // Check if there are external calls to add External participant
  const hasExternalCalls = flow.steps.some(s => s.externalCalls.length > 0);
  if (hasExternalCalls) {
    mermaid += '  participant External\n';
  }

  // Add interactions for each step
  flow.steps.forEach((step, idx) => {
    // Add role requirement note
    if (step.requiredRole) {
      mermaid += `  Note over User,${flow.entryPoint.contractName || 'Contract'}: 🔒 Requires ${step.requiredRole}\n`;
    }

    // User calls contract function
    if (idx === 0) {
      mermaid += `  User->>+${flow.entryPoint.contractName || 'Contract'}: ${step.functionName}()\n`;
    } else {
      mermaid += `  activate ${flow.entryPoint.contractName || 'Contract'}\n`;
      mermaid += `  Note over ${flow.entryPoint.contractName || 'Contract'}: ${step.functionName}()\n`;
    }

    // Show external calls
    if (step.externalCalls.length > 0) {
      step.externalCalls.forEach(call => {
        mermaid += `  ${flow.entryPoint.contractName || 'Contract'}->>+External: ${call}()\n`;
        mermaid += `  External-->>-${flow.entryPoint.contractName || 'Contract'}: return\n`;
      });
    }

    // Show state changes as notes
    if (step.stateChanges.length > 0) {
      const stateList = step.stateChanges.slice(0, 3).join(', ');
      const more = step.stateChanges.length > 3 ? `, +${step.stateChanges.length - 3} more` : '';
      mermaid += `  Note over ${flow.entryPoint.contractName || 'Contract'}: 💾 State: ${stateList}${more}\n`;
    }

    // Show events
    if (step.events.length > 0) {
      step.events.forEach(event => {
        mermaid += `  ${flow.entryPoint.contractName || 'Contract'}-->>User: 📢 ${event}\n`;
      });
    }

    if (idx > 0) {
      mermaid += `  deactivate ${flow.entryPoint.contractName || 'Contract'}\n`;
    }
  });

  // Close the initial activation
  mermaid += `  ${flow.entryPoint.contractName || 'Contract'}-->>-User: return\n`;

  return {
    flowId: flow.id,
    diagramType: 'sequenceDiagram',
    mermaidCode: mermaid,
    description: `Sequence diagram for ${flow.name}`
  };
}

/**
 * Generate all three diagram types for a flow
 * This gives the most comprehensive view
 */
export function generateAllDiagramsForFlow(flow: UserFlow): MermaidDiagram[] {
  return [
    generateFlowchartForUserFlow(flow),
    generateStateDiagramForFlow(flow),
    generateSequenceDiagramForFlow(flow),
  ];
}

/**
 * Generate diagrams for multiple flows
 */
export function generateDiagramsForFlows(flows: UserFlow[]): MermaidDiagram[] {
  const diagrams: MermaidDiagram[] = [];

  for (const flow of flows) {
    diagrams.push(...generateAllDiagramsForFlow(flow));
  }

  return diagrams;
}
