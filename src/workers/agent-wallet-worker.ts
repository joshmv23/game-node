import { ExecutableGameFunctionResponse, ExecutableGameFunctionStatus, GameFunction, GameWorker } from "@virtuals-protocol/game";
import { Delegatee } from '@lit-protocol/agent-wallet';

export function createAgentWalletWorker(delegatee: Delegatee) {
    const signFunction = new GameFunction({
        name: "sign_message",
        description: "Sign a message using the delegatee's wallet",
        args: [
            { name: "message", description: "Message to sign" }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Signing message: ${args.message}`);
                const signature = await delegatee.signMessage(args.message);
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Done,
                    `Message signed successfully: ${signature}`
                );
            } catch (error: any) {
                return new ExecutableGameFunctionResponse(
                    ExecutableGameFunctionStatus.Failed,
                    `Failed to sign message: ${error.message}`
                );
            }
        }
    });

    const transferFunction = new GameFunction({
        name: "transfer_erc20",
        description: "Transfer ERC20 tokens using the delegatee's wallet",
        args: [
            { name: "token", description: "Token contract address" },
            { name: "to", description: "Recipient address" },
            { name: "amount", description: "Amount to transfer" }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating transfer of ${args.amount} tokens to ${args.to}`);
                const result = await delegatee.transferERC20(args.token, args.to, args.amount);
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
        name: "swap_tokens",
        description: "Swap tokens using Uniswap through the delegatee's wallet",
        args: [
            { name: "tokenIn", description: "Input token address" },
            { name: "tokenOut", description: "Output token address" },
            { name: "amountIn", description: "Input amount" },
            { name: "slippage", description: "Maximum slippage percentage", optional: true }
        ] as const,
        executable: async (args, logger) => {
            try {
                logger(`Initiating swap of ${args.amountIn} ${args.tokenIn} to ${args.tokenOut}`);
                const slippage = args.slippage || "0.5"; // Default 0.5% slippage
                const result = await delegatee.swapExactTokensForTokens(
                    args.tokenIn,
                    args.tokenOut,
                    args.amountIn,
                    slippage
                );
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

    return new GameWorker({
        id: "agent_wallet_worker",
        name: "Agent Wallet Operations",
        description: "Worker that handles all Agent Wallet operations including transfers, swaps, and signing",
        functions: [signFunction, transferFunction, swapFunction],
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