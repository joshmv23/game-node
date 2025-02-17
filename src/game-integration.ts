import {
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
    GameFunction,
    GameWorker,
    GameAgent
} from "@virtuals-protocol/game";
import { VirtualsPolicy__factory } from '../typechain-types';
import { ethers } from 'ethers';
import VirtualsAgentWallet from './lit-agent-wallet';

// Initialize the Agent Wallet as our Task Generator
const agentWallet = new VirtualsAgentWallet();

// Define Workers for specific operations
const transferWorker = new GameWorker({
    id: "transfer_worker",
    name: "Transfer Operations Worker",
    description: "Specialized worker for executing token transfers within policy constraints",
    functions: [
        new GameFunction({
            name: "execute_transfer",
            description: "Execute a policy-compliant token transfer",
            args: [
                { name: "token", description: "Token address or 'ETH' for native token" },
                { name: "to", description: "Recipient address" },
                { name: "amount", description: "Amount to transfer" }
            ] as const,
            executable: async (args, logger) => {
                try {
                    if (!args.token || !args.to || !args.amount) {
                        throw new Error("Missing required arguments");
                    }

                    logger(`Executing transfer of ${args.amount} ${args.token} to ${args.to}`);
                    await agentWallet.executeTransfer(args.token, args.to, args.amount);
                    
                    return new ExecutableGameFunctionResponse(
                        ExecutableGameFunctionStatus.Done,
                        `Transfer completed successfully`
                    );
                } catch (error: any) {
                    return new ExecutableGameFunctionResponse(
                        ExecutableGameFunctionStatus.Failed,
                        `Transfer failed: ${error.message}`
                    );
                }
            }
        })
    ]
});

const swapWorker = new GameWorker({
    id: "swap_worker",
    name: "Swap Operations Worker",
    description: "Specialized worker for executing token swaps within policy constraints",
    functions: [
        new GameFunction({
            name: "execute_swap",
            description: "Execute a policy-compliant token swap",
            args: [
                { name: "tokenIn", description: "Input token address" },
                { name: "tokenOut", description: "Output token address" },
                { name: "amount", description: "Amount to swap" }
            ] as const,
            executable: async (args, logger) => {
                try {
                    if (!args.tokenIn || !args.tokenOut || !args.amount) {
                        throw new Error("Missing required arguments");
                    }

                    logger(`Executing swap of ${args.amount} ${args.tokenIn} to ${args.tokenOut}`);
                    await agentWallet.executeSwap(args.tokenIn, args.tokenOut, args.amount);
                    
                    return new ExecutableGameFunctionResponse(
                        ExecutableGameFunctionStatus.Done,
                        `Swap completed successfully`
                    );
                } catch (error: any) {
                    return new ExecutableGameFunctionResponse(
                        ExecutableGameFunctionStatus.Failed,
                        `Swap failed: ${error.message}`
                    );
                }
            }
        })
    ]
});

// Create the Agent with the Agent Wallet as Task Generator
export const blockchainAgent = new GameAgent(process.env.VIRTUALS_API_KEY || "", {
    name: "Virtuals Agent Wallet",
    goal: "Execute secure blockchain operations within admin-set policies",
    description: `A policy-constrained agent wallet that:
        - Acts as a Task Generator to coordinate specialized workers
        - Enforces admin-defined policy constraints
        - Manages secure execution of blockchain operations
        - Maintains operation logs and state`,
    workers: [transferWorker, swapWorker],
    getAgentState: async () => {
        const policy = VirtualsPolicy__factory.connect(
            process.env.POLICY_ADDRESS || "",
            new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
        );

        return {
            walletAddress: process.env.LIT_AGENT_WALLET_ADDRESS,
            allowedFunctions: await policy.allowedFunctions(ethers.utils.id("transfer(address,uint256)").slice(0, 10)),
            maxAmount: await policy.maxTransactionAmount(),
        };
    },
});

// Initialize the system
export async function initializeSystem() {
    await agentWallet.init();
    await blockchainAgent.init();
    
    blockchainAgent.setLogger((msg) => {
        console.log(`[${blockchainAgent.name}] ${msg}`);
    });
}

// Initialize and run the system
export async function runBlockchainAgent() {
    // Initialize everything
    await agentWallet.init();
    await blockchainAgent.init();
    
    // Set up custom logger
    blockchainAgent.setLogger((msg) => {
        console.log(`-----[${blockchainAgent.name}]-----`);
        console.log(msg);
        console.log("----------------------------------------");
    });

    // Run the agent with continuous monitoring
    await blockchainAgent.run(60, { verbose: true }); // Check every 60 seconds
}

// Run if this file is executed directly
if (require.main === module) {
    runBlockchainAgent().catch(console.error);
}