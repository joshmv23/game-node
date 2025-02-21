import {
    GameAgent,
    GameWorker,
} from "@virtuals-protocol/game";
import dotenv from 'dotenv';
import { createAgentWalletWorker } from '../workers/agent-wallet-worker';
import { Delegatee } from '@lit-protocol/agent-wallet';
import { LIT_NETWORKS } from '@lit-protocol/constants';
import * as fs from 'fs';
import * as path from 'path';
import { LitNodeClient } from '@lit-protocol/lit-node-client';

dotenv.config();

async function main() {
    try {
        // Initialize Lit Node Client
        const litNodeClient = new LitNodeClient({
            litNetwork: "datil-dev",
            debug: false
        });
        await litNodeClient.connect();

        // Read existing delegatee from storage
        const storagePath = path.join(__dirname, '../../../agent-wallet/.law-signer-delegatee-storage/delegatees');
        const delegateesData = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
        const delegateeAddress = Object.keys(delegateesData)[0];
        const delegateePrivateKey = delegateesData[delegateeAddress].privateKey;

        // Initialize delegatee
        const delegatee = await Delegatee.create(
            delegateePrivateKey,
            {
                litNetwork: "datil-dev"
            }
        );
        
        // Create the worker with the delegatee
        const agentWalletWorker = createAgentWalletWorker(delegatee);

        // Create the agent
        const agent = new GameAgent(process.env.VIRTUALS_API_KEY || "", {
            name: "Agent Wallet Tester",
            goal: "Test agent wallet operations",
            description: "An agent that tests transfer, swap, and signing operations",
            workers: [agentWalletWorker],
            getAgentState: async () => ({
                network: "datil-dev",
                chainId: 175177,
                lastOperation: Date.now()
            })
        });

        // Initialize the agent
        await agent.init();
        
        // Set up logging
        agent.setLogger((msg) => {
            console.log(`[${agent.name}] ${msg}`);
        });

        // Test tasks
        const tasks = [
            // Test ETH transfer
            "Transfer 0.1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            
            // Test ERC20 transfer (using USDC address on testnet)
            "Transfer 10 USDC from 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            
            // Test swap
            "Swap 0.1 ETH for USDC using best available rate",
            
            // Test signing
            "Sign the message 'Hello World'"
        ];

        // Process each task
        for (const task of tasks) {
            console.log(`\nProcessing task: ${task}`);
            await agent.workers[0].runTask(task, { verbose: true });
            
            // Add delay between tasks
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log("\nAll tasks completed!");

    } catch (error: any) {
        console.error("Error running agent wallet tests:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
} 