import dotenv from 'dotenv';
dotenv.config();

import {
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
  GameAgent,
  GameFunction,
  GameWorker,
} from "@virtuals-protocol/game";
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { AuthSig } from '@lit-protocol/types';
import { ethers } from 'ethers';
import { Token, CurrencyAmount, Percent } from '@uniswap/sdk-core';
import { Pool, SwapRouter } from '@uniswap/v3-sdk';
import { SiweMessage } from 'siwe';
import { LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from '@lit-protocol/auth-helpers';
import { LIT_ABILITY, LIT_RPC } from '@lit-protocol/constants';

// ERC20 Interface
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

// Initialize Lit Client
export const litNodeClient = new LitNodeClient({
  litNetwork: 'datil-test',
  debug: true,
  minNodeCount: 2
});

// Configuration
const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

export let pkpWallet: PKPEthersWallet;

// Initialize PKP wallet
export const initializePKPWallet = async (pkpPublicKey: string): Promise<PKPEthersWallet> => {
  if (!litNodeClient.ready) await litNodeClient.connect();
  
  const provider = new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);

  const resourceAbilities = [{
    resource: new LitActionResource('*'),
    ability: LIT_ABILITY.LitActionExecution
  }];

  const sessionSigs = await litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: new Date(Date.now() + 60_000 * 60).toISOString(),
    resourceAbilityRequests: resourceAbilities,
    authNeededCallback: async ({ resourceAbilityRequests, expiration, uri }) => {
      const toSign = await createSiweMessageWithRecaps({
        uri: 'https://localhost/login',
        expiration: expiration || new Date(Date.now() + 60_000 * 60).toISOString(),
        resources: resourceAbilityRequests || [],
        walletAddress: await wallet.getAddress(),
        nonce: await litNodeClient.getLatestBlockhash(),
        litNodeClient,
      });

      return await generateAuthSig({
        signer: wallet,
        toSign,
      });
    },
  });

  const newPkpWallet = new PKPEthersWallet({
    pkpPubKey: pkpPublicKey,
    provider,
    litNodeClient: litNodeClient,
    authContext: {
      getSessionSigsProps: {
        chain: "ethereum",
        resourceAbilityRequests: resourceAbilities,
        authNeededCallback: async () => ({
          sig: "test",
          derivedVia: "web3.eth.personal.sign",
          signedMessage: "test",
          address: await wallet.getAddress()
        })
      }
    }
  });
  
  await newPkpWallet.init();
  pkpWallet = newPkpWallet;
  return pkpWallet;
};

// Add Uniswap Router ABI
const SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
];

// Wallet Functions
const swapTokensFunction = new GameFunction({
  name: "swap_tokens",
  description: "Swap tokens using Lit Agent Wallet via Uniswap",
  args: [
    { name: "tokenIn", description: "Token address to swap from" },
    { name: "tokenOut", description: "Token address to swap to" },
    { name: "amount", description: "Amount to swap in wei" },
    { name: "slippage", description: "Maximum slippage percentage", optional: true },
  ] as const,
  executable: async (args, logger) => {
    try {
      if (!pkpWallet) throw new Error("PKP wallet not initialized");
      if (typeof args.tokenIn !== 'string') throw new Error("Invalid tokenIn address");
      if (typeof args.tokenOut !== 'string') throw new Error("Invalid tokenOut address");
      
      logger(`Initiating swap of ${args.amount} ${args.tokenIn} to ${args.tokenOut}`);
      logger(`Slippage set to: ${args.slippage || '0.5'}%`);

      // If tokenIn is not ETH, approve Uniswap router
      if (args.tokenIn !== 'ETH') {
        const tokenContract = new ethers.Contract(args.tokenIn, ERC20_ABI, pkpWallet);
        const approveTx = await tokenContract.approve(UNISWAP_ROUTER, args.amount);
        await approveTx.wait();
        logger('Approved token for swap');
      }

      // Initialize Uniswap Router contract
      const router = new ethers.Contract(
        UNISWAP_ROUTER,
        SWAP_ROUTER_ABI,
        pkpWallet
      );

      // Prepare swap parameters
      const params = {
        tokenIn: args.tokenIn === 'ETH' ? WETH_ADDRESS : args.tokenIn,
        tokenOut: args.tokenOut === 'ETH' ? WETH_ADDRESS : args.tokenOut,
        fee: 3000, // 0.3% fee tier
        recipient: await pkpWallet.getAddress(),
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
        amountIn: args.amount,
        amountOutMinimum: 0, // Set this based on price impact calculation
        sqrtPriceLimitX96: 0,
      };

      // Execute swap
      const tx = await router.exactInputSingle(params, {
        value: args.tokenIn === 'ETH' ? args.amount : 0,
        gasLimit: 300000,
      });

      await tx.wait();
      logger('Swap executed successfully');
      
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        `Swap completed: ${args.amount} ${args.tokenIn} -> ${args.tokenOut}`
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to swap tokens: ${error.message}`
      );
    }
  },
});

const transferTokensFunction = new GameFunction({
  name: "transfer_token",
  description: "Transfer tokens using Lit Agent Wallet",
  args: [
    { name: "token", description: "Token contract address or 'ETH' for native token" },
    { name: "recipient", description: "Recipient address" },
    { name: "amount", description: "Amount to transfer (in token units, not wei)" },
  ] as const,
  executable: async (args, logger) => {
    try {
      if (!pkpWallet) throw new Error("PKP wallet not initialized");
      if (!args.token || !args.recipient || !args.amount) throw new Error("Missing required arguments");
      
      logger(`Initiating transfer of ${args.amount} tokens to ${args.recipient}`);

      let tx;
      let receipt;

      if (args.token === 'ETH') {
        const amountWei = ethers.utils.parseEther(args.amount);
        tx = await pkpWallet.sendTransaction({
          to: args.recipient,
          value: amountWei
        });
      } else {
        const tokenContract = new ethers.Contract(args.token, ERC20_ABI, pkpWallet);
        const decimals = await tokenContract.decimals();
        const amountInTokenUnits = ethers.utils.parseUnits(args.amount, decimals);
        
        tx = await tokenContract.transfer(args.recipient, amountInTokenUnits);
      }

      logger(`Transaction sent with hash: ${tx.hash}`);
      receipt = await tx.wait();
      
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        `Transfer complete! Transaction hash: ${receipt.transactionHash}`
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to transfer tokens: ${error.message}`
      );
    }
  },
});

const checkBalanceFunction = new GameFunction({
  name: "check_balance",
  description: "Check token balance in Lit Agent Wallet",
  args: [
    { name: "token", description: "Token contract address or 'ETH' for native token" },
  ] as const,
  executable: async (args, logger) => {
    try {
      if (!pkpWallet) throw new Error("PKP wallet not initialized");
      if (!args.token) throw new Error("Token address is required");
      
      logger(`Checking balance for ${args.token}`);

      let balance;
      let symbol;
      let decimals;

      if (args.token === 'ETH') {
        balance = await pkpWallet.getBalance();
        symbol = 'ETH';
        decimals = 18;
      } else {
        const tokenContract = new ethers.Contract(args.token, ERC20_ABI, pkpWallet);
        balance = await tokenContract.balanceOf(await pkpWallet.getAddress());
        symbol = await tokenContract.symbol();
        decimals = await tokenContract.decimals();
      }
      
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        `Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`
      );
    } catch (error: any) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Failed to check balance: ${error.message}`
      );
    }
  },
});

// Create a worker with the wallet functions
export const litWalletWorker = new GameWorker({
  id: "lit_wallet_worker",
  name: "Lit Wallet Worker",
  description: "Worker that handles Lit Protocol wallet operations",
  functions: [swapTokensFunction, transferTokensFunction, checkBalanceFunction],
  getEnvironment: async () => {
    return {
      network: "datil-test",
      chainId: 175177,  // Chronicle Yellowstone testnet
      pkpPublicKey: process.env.PKP_PUBLIC_KEY,
      rpcUrl: LIT_RPC.CHRONICLE_YELLOWSTONE,
    };
  },
});

// Create an agent with the worker
const agent = new GameAgent(process.env.VIRTUALS_API_KEY || "YOUR_API_KEY", {
  name: "Lit Wallet Agent",
  goal: "Manage wallet operations using Lit Protocol",
  description: "An agent that can perform wallet operations like swaps and transfers using Lit Protocol",
  workers: [litWalletWorker],
});

// Example usage
(async () => {
  try {
    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE);
    
    // Create two regular wallets
    const wallet1 = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
    const wallet2 = new ethers.Wallet(process.env.PRIVATE_KEY_2 || "", provider);

    console.log("\nWallet Addresses:");
    console.log("Wallet 1 (Sender):", await wallet1.getAddress());
    console.log("Wallet 2 (Recipient):", await wallet2.getAddress());

    // Check initial balances
    console.log("\nInitial balances:");
    const wallet1InitialBalance = await wallet1.getBalance();
    const wallet2InitialBalance = await wallet2.getBalance();
    console.log("Wallet 1 balance:", ethers.utils.formatEther(wallet1InitialBalance), "ETH");
    console.log("Wallet 2 balance:", ethers.utils.formatEther(wallet2InitialBalance), "ETH");

    // Transfer ETH from wallet1 to wallet2
    console.log("\nTransferring 0.001 ETH from Wallet 1 to Wallet 2...");
    const tx = await wallet1.sendTransaction({
      to: wallet2.address,
      value: ethers.utils.parseEther("0.001"), // Sending 0.001 ETH
      gasLimit: 300000,
    });

    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Transfer completed!");

    // Check final balances
    console.log("\nFinal balances:");
    const wallet1FinalBalance = await wallet1.getBalance();
    const wallet2FinalBalance = await wallet2.getBalance();
    console.log("Wallet 1 balance:", ethers.utils.formatEther(wallet1FinalBalance), "ETH");
    console.log("Wallet 2 balance:", ethers.utils.formatEther(wallet2FinalBalance), "ETH");

    // Calculate and display the changes
    console.log("\nBalance changes:");
    console.log("Wallet 1 change:", ethers.utils.formatEther(wallet1FinalBalance.sub(wallet1InitialBalance)), "ETH");
    console.log("Wallet 2 change:", ethers.utils.formatEther(wallet2FinalBalance.sub(wallet2InitialBalance)), "ETH");

  } catch (error: any) {
    console.error("Error:", error.message);
  }
})(); 