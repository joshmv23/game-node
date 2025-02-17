import {
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
    GameFunction,
    GameWorker,
} from "@virtuals-protocol/game";
import { ethers } from 'ethers';

// Create a function that generates the worker with an initialized delegatee
export function createAgentWalletWorker(delegatee: any) {
    const transferFunction = new GameFunction({
        name: "execute_transfer",
        description: "Execute a token transfer using Agent Wallet",
        args: [
            { name: "token", description: "Token address or 'ETH' for native token" },
            { name: "to", description: "Recipient address" },
            { name: "amount", description: "Amount to transfer" }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating transfer of ${args.amount} ${args.token} to ${args.to}`);
                
                const result = await delegatee.executeTool(
                    "QmVHC5cTWE1nzBSzEASULdwfHo1QiYMEr5Ht83anxe6uWB",
                    {
                        token: args.token,
                        to: args.to,
                        amount: args.amount
                    }
                );

                if (!result.success) {
                    throw new Error(result.error || "Transfer failed");
                }

                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Done,
                    `Transfer completed successfully: ${result.hash}`
                );
            } catch (error: any) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    `Transfer failed: ${error.message}`
                );
            }
        }
    });

    const swapFunction = new GameFunction({
        name: "execute_swap",
        description: "Execute a token swap using Agent Wallet",
        args: [
            { name: "tokenIn", description: "Input token address" },
            { name: "tokenOut", description: "Output token address" },
            { name: "amount", description: "Amount to swap" }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating swap of ${args.amount} ${args.tokenIn} to ${args.tokenOut}`);
                
                const result = await delegatee.executeTool(
                    "Qmc6RAbV3WAqfNLvkAxp4hYjd4TDim4PwjWyhGbM9X7nbR",
                    {
                        tokenIn: args.tokenIn,
                        tokenOut: args.tokenOut,
                        amount: args.amount
                    }
                );

                if (!result.success) {
                    throw new Error(result.error || "Swap failed");
                }

                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Done,
                    `Swap completed successfully: ${result.hash}`
                );
            } catch (error: any) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    `Swap failed: ${error.message}`
                );
            }
        }
    });

    const signFunction = new GameFunction({
        name: "execute_sign",
        description: "Sign a message or transaction using Agent Wallet",
        args: [
            { name: "message", description: "Message or transaction to sign" },
            { name: "type", description: "Type of signing (message/transaction)" }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating signing of ${args.type}: ${args.message}`);
                
                const result = await delegatee.executeTool(
                    "QmSignatureToolIPFSHash",
                    {
                        message: args.message,
                        type: args.type
                    }
                );

                if (!result.success) {
                    throw new Error(result.error || "Signing failed");
                }

                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Done,
                    `Signing completed successfully: ${result.signature}`
                );
            } catch (error: any) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    `Signing failed: ${error.message}`
                );
            }
        }
    });

    // Create and return the worker
    return new GameWorker({
        id: "agent_wallet_worker",
        name: "Agent Wallet Operations",
        description: "Worker that handles all Agent Wallet operations including transfers, swaps, and signing",
        functions: [transferFunction, swapFunction, signFunction],
        getEnvironment: async () => {
            // Get tool information using getToolByIpfsCid
            const transferTool = delegatee.getToolByIpfsCid("QmVHC5cTWE1nzBSzEASULdwfHo1QiYMEr5Ht83anxe6uWB");
            const swapTool = delegatee.getToolByIpfsCid("Qmc6RAbV3WAqfNLvkAxp4hYjd4TDim4PwjWyhGbM9X7nbR");

            return {
                network: "datil-dev",
                chainId: 175177,
                maxGasPrice: "50", // gwei
                slippageTolerance: "0.5", // percent
                availableTools: {
                    transfer: transferTool?.tool,
                    swap: swapTool?.tool
                }
            };
        },
    });
} 