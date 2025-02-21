import {
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus,
    GameFunction,
    GameWorker,
} from "@virtuals-protocol/game";
import { Delegatee } from '@lit-protocol/agent-wallet';

// Create a function that generates the worker with an initialized delegatee
export function createAgentWalletWorker(delegatee: Delegatee) {
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
               
                const result = await delegatee.executeTool({
                    code: `
                        // Transfer function code will be loaded from IPFS
                        const transfer = async () => {
                            // Implementation will be provided by the tool
                        };
                        transfer();
                    `,
                    jsParams: {
                        token: args.token,
                        to: args.to,
                        amount: args.amount
                    }
                });

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
    });

    const swapFunction = new GameFunction({
        name: "execute_swap",
        description: "Execute a token swap using Uniswap V3",
        args: [
            { name: "tokenIn", description: "Input token address" },
            { name: "tokenOut", description: "Output token address" },
            { name: "amount", description: "Amount to swap" }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating swap of ${args.amount} ${args.tokenIn} to ${args.tokenOut}`);
               
                const result = await delegatee.executeTool({
                    code: `
                        // Swap function code will be loaded from IPFS
                        const swap = async () => {
                            // Implementation will be provided by the tool
                        };
                        swap();
                    `,
                    jsParams: {
                        tokenIn: args.tokenIn,
                        tokenOut: args.tokenOut,
                        amount: args.amount
                    }
                });

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
    });

    const signFunction = new GameFunction({
        name: "execute_sign",
        description: "Sign a message or transaction using ECDSA",
        args: [
            { name: "message", description: "Message to sign" },
            { name: "type", description: "Type of signing (personal/typed)", optional: true }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating signing of message: ${args.message}`);
               
                const result = await delegatee.executeTool({
                    code: `
                        // Signing function code will be loaded from IPFS
                        const sign = async () => {
                            // Implementation will be provided by the tool
                        };
                        sign();
                    `,
                    jsParams: {
                        message: args.message,
                        type: args.type || "personal"
                    }
                });

                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Done,
                    `Message signed successfully`
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
        description: "Worker that handles all Agent Wallet operations including transfers, swaps, and ECDSA signing",
        functions: [transferFunction, swapFunction, signFunction],
        getEnvironment: async () => {
            return {
                network: "datil-dev",
                chainId: 175177,
                maxGasPrice: "50", // gwei
                slippageTolerance: "0.5", // percent
            };
        },
    });
}
 
 