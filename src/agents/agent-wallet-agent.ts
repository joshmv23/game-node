import { GameAgent } from "@virtuals-protocol/game";
import { createAgentWalletWorker } from '../workers/agent-wallet-worker';
import dotenv from 'dotenv';

dotenv.config();

// Create a function that initializes the agent with a delegatee
export function createAgentWalletAgent(delegatee: any) {
    const worker = createAgentWalletWorker(delegatee);
    
    return new GameAgent(process.env.VIRTUALS_API_KEY || "", {
        name: "Agent Wallet Delegatee",
        goal: "Execute secure blockchain operations through Agent Wallet",
        description: `An AI delegatee that:
            - Interprets user intents and selects appropriate Agent Wallet tools
            - Executes transfers, swaps, and signing operations
            - Operates within defined security policies
            - Provides clear reasoning for each operation`,
        workers: [worker],
        getAgentState: async () => {
            return {
                network: "datil-dev",
                chainId: 175177,
                lastOperation: Date.now(),
                operationCount: 0,
            };
        },
    });
}

// Function to run the agent
export async function runAgentWalletDelegatee(delegatee: any) {
    try {
        // Create and initialize the agent with the delegatee
        const agent = createAgentWalletAgent(delegatee);
        await agent.init();
        
        // Set up custom logging
        agent.setLogger((msg) => {
            console.log(`[${agent.name}] ${msg}`);
        });

        // Example tasks that demonstrate natural language processing
        const tasks = [
            "Transfer 0.1 ETH to 0x123...",
            "Swap 100 USDC for ETH with minimal slippage",
            "Sign this message: 'Hello World'"
        ];

        // Process each task
        for (const task of tasks) {
            console.log(`\nProcessing task: ${task}`);
            await agent.step();
        }

    } catch (error: any) {
        console.error("Error running Agent Wallet delegatee:", error.message);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    // Load existing delegatee from storage
    const fs = require('fs');
    const path = require('path');
    
    const delegateesPath = path.join(__dirname, '../../../agent-wallet/.law-signer-delegatee-storage/delegatees');
    const delegateesData = JSON.parse(fs.readFileSync(delegateesPath, 'utf8'));
    
    // Get the first delegatee address (you might want to make this configurable)
    const delegateeAddress = Object.keys(delegateesData)[0];
    if (!delegateeAddress) {
        throw new Error("No delegatee found in storage. Please add a delegatee using the CLI first.");
    }

    const { Delegatee } = require('../../agent-wallet/src/agent-wallet');
    const delegatee = new Delegatee({
        network: "datil-dev",
        address: delegateeAddress,
        debug: true
    });
    
    runAgentWalletDelegatee(delegatee);
} 