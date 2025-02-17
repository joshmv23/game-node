import dotenv from 'dotenv';
dotenv.config();

import {
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
    GameAgent,
    GameFunction,
    GameWorker,
} from "@virtuals-protocol/game";
import VirtualsAgentWallet from '../lit-agent-wallet';

// Initialize the Lit Agent Wallet
const agentWallet = new VirtualsAgentWallet();

// Define token-related functions with detailed descriptions
const checkBalanceFunction = new GameFunction({
    name: "check_balance",
    description: "Check token balance for a specific token address. Returns the balance in token units with proper decimals.",
    args: [
        { name: "token", description: "Token contract address to check balance for" },
        { name: "address", description: "Address to check balance for" },
    ] as const,
    executable: async (args, logger) => {
        try {
            if (!args.token || !args.address) {
                throw new Error("Missing required arguments");
            }
            logger(`Checking balance of ${args.token} for address ${args.address}`);
            const balance = await agentWallet.checkBalance(args.token, args.address);
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Balance: ${balance}`
            );
        } catch (error: any) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                `Failed to check balance: ${error.message}`
            );
        }
    },
});

const transferTokensFunction = new GameFunction({
    name: "transfer_tokens",
    description: "Transfer tokens with policy enforcement. Ensures transfers comply with daily limits and token allowances.",
    args: [
        { name: "token", description: "Token contract address to transfer" },
        { name: "to", description: "Recipient address" },
        { name: "amount", description: "Amount to transfer in token units" },
    ] as const,
    executable: async (args, logger) => {
        try {
            if (!args.token || !args.to || !args.amount) {
                throw new Error("Missing required arguments");
            }
            logger(`Initiating policy-compliant transfer of ${args.amount} ${args.token} to ${args.to}`);
            const result = await agentWallet.executeTransfer(
                args.token,
                args.to,
                args.amount
            );
            logger('Transfer executed successfully');
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Transfer completed: ${args.amount} ${args.token} -> ${args.to}`
            );
        } catch (error: any) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                `Failed to transfer tokens: ${error.message}`
            );
        }
    },
});

const swapTokensFunction = new GameFunction({
    name: "swap_tokens",
    description: "Execute token swaps via Uniswap with policy enforcement. Handles price impact checks and slippage protection.",
    args: [
        { name: "tokenIn", description: "Token address to swap from" },
        { name: "tokenOut", description: "Token address to swap to" },
        { name: "amountIn", description: "Amount of input token to swap" },
        { name: "maxSlippage", description: "Maximum allowed slippage in percentage", optional: true },
    ] as const,
    executable: async (args, logger) => {
        try {
            if (!args.tokenIn || !args.tokenOut || !args.amountIn) {
                throw new Error("Missing required arguments");
            }
            logger(`Initiating policy-compliant swap of ${args.amountIn} ${args.tokenIn} to ${args.tokenOut}`);
            const result = await agentWallet.executeSwap(
                args.tokenIn,
                args.tokenOut,
                args.amountIn
            );
            logger('Swap executed successfully');
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Done,
                `Swap completed: ${args.amountIn} ${args.tokenIn} -> ${args.tokenOut}`
            );
        } catch (error: any) {
            return new ExecutableGameFunctionResponse(
                ExecutableGameFunctionStatus.Failed,
                `Failed to swap tokens: ${error.message}`
            );
        }
    },
});

// Create specialized workers for different token operations
const tokenQueryWorker = new GameWorker({
    id: "token_query_worker",
    name: "Token Information Worker",
    description: "Specialized worker for querying token information and balances. Handles all read-only token operations.",
    functions: [checkBalanceFunction],
});

const tokenTransferWorker = new GameWorker({
    id: "token_transfer_worker",
    name: "Token Transfer Worker",
    description: "Specialized worker for executing token transfers with policy enforcement. Ensures all transfers comply with security policies.",
    functions: [transferTokensFunction],
});

const tokenSwapWorker = new GameWorker({
    id: "token_swap_worker",
    name: "Token Swap Worker",
    description: "Specialized worker for executing token swaps via Uniswap. Handles price checks, slippage protection, and policy compliance.",
    functions: [swapTokensFunction],
});

// Create the high-level agent that coordinates the workers
const agent = new GameAgent(process.env.VIRTUALS_API_KEY || "", {
    name: "Virtuals Token Operations Agent",
    goal: "Safely manage token operations while ensuring compliance with security policies and optimal execution",
    description: `A sophisticated agent that manages token operations on the Chronicle Yellowstone network.
        - Enforces security policies for all token operations
        - Optimizes swap routes and handles slippage protection
        - Maintains detailed operation logs
        - Ensures all operations comply with daily limits and token allowances
        - Coordinates between different specialized workers for optimal execution`,
    workers: [tokenQueryWorker, tokenTransferWorker, tokenSwapWorker],
});

// Example usage with natural language tasks
async function runExample() {
    try {
        // Initialize everything
        await agentWallet.init();
        await agent.init();

        // Set up custom logger
        agent.setLogger((msg) => {
            console.log(`-----[${agent.name}]-----`);
            console.log(msg);
            console.log("\n");
        });

        // Example tasks that demonstrate natural language processing
        const tasks = [
            `Check the testLIT token balance for ${await agentWallet.getWallet()?.getAddress()}`,
            `Check the LIT token balance at 0x81d8f0e945E3Bdc735dA3E19C4Df77a8B91046Cd`,
            `Transfer 0.1 LIT tokens from 0x81d8f0e945E3Bdc735dA3E19C4Df77a8B91046Cd to ${await agentWallet.getWallet()?.getAddress()}`
        ];

        for (const task of tasks) {
            console.log(`\nExecuting task: ${task}`);
            await agent.step();
        }

    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

if (require.main === module) {
    runExample();
} 