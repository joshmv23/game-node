import { GameAgent } from "@virtuals-protocol/game";
import { litAgentWorker } from '../workers/lit-agent-worker';
import dotenv from 'dotenv';

dotenv.config();

// Create the trading agent
export const tradingAgent = new GameAgent(process.env.VIRTUALS_API_KEY || "", {
  name: "Virtuals Trading Agent",
  goal: "Optimize token trading and portfolio management using AI-driven analysis",
  description: `An autonomous agent that:
    - Analyzes market conditions and token prices
    - Executes trades when conditions are favorable
    - Manages portfolio risk and rebalancing
    - Operates within admin-set policies and limits
    - Uses Lit Protocol for secure transaction execution`,
  workers: [litAgentWorker],
  getAgentState: async () => {
    return {
      network: "datil-dev",
      chainId: 175177,
      lastAnalysis: Date.now(),
      tradingStrategy: "medium_risk",
      portfolioValue: "10000 USD", // This would be dynamically calculated
    };
  },
});

// Example usage
export async function runTradingAgent() {
  try {
    // Initialize everything
    await tradingAgent.init();
    
    // Set up custom logger
    tradingAgent.setLogger((msg) => {
      console.log(`[${tradingAgent.name}] ${msg}`);
    });

    // Example tasks that demonstrate natural language processing
    const tasks = [
      "Analyze the current market conditions for ETH and USDC",
      "Check if we should rebalance the portfolio based on current market conditions",
      "If market conditions are favorable, swap 0.1 ETH to USDC using optimal routing"
    ];

    for (const task of tasks) {
      console.log(`\nExecuting task: ${task}`);
      await tradingAgent.step();
    }

  } catch (error: any) {
    console.error("Error running trading agent:", error.message);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runTradingAgent();
} 