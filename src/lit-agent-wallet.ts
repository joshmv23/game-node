import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from '@lit-protocol/auth-helpers';
import { LIT_ABILITY, LIT_RPC } from '@lit-protocol/constants';
import { VirtualsToken__factory, VirtualsPolicy__factory, LitAgentWallet__factory, LitAgentWallet, VirtualsPolicy } from '../typechain-types';
import { LIT_NETWORKS } from '@lit-protocol/constants';

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint amount) returns (bool)"
];

dotenv.config();

interface ToolPolicy {
    maxAmount: string;
    allowedTokens: string[];
    dailyLimit: string;
    requiredVotingPower: string;
}

class VirtualsAgentWallet {
    private litNodeClient: LitNodeClient;
    private pkpWallet: PKPEthersWallet | null = null;
    private provider: ethers.providers.JsonRpcProvider;
    private virtualsPolicyContract: VirtualsPolicy | null = null;
    private litAgentWalletContract: LitAgentWallet | null = null;
    
    constructor() {
        this.litNodeClient = new LitNodeClient({
            litNetwork: "datil-dev",
            debug: true,
            minNodeCount: 2,
            connectTimeout: 20000,
            defaultAuthCallback: async () => {
                return {
                    sig: "",
                    derivedVia: "lit-default",
                    signedMessage: "",
                    address: ""
                };
            }
        });
        
        this.provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    }
    
    // Public getter for pkpWallet
    public getWallet(): PKPEthersWallet | null {
        return this.pkpWallet;
    }
    
    async init() {
        try {
            // Connect to Lit nodes
            console.log("Connecting to Lit nodes...");
            await this.litNodeClient.connect();
            console.log("Successfully connected to Lit nodes");
            
            if (!process.env.POLICY_ADDRESS || !process.env.LIT_AGENT_WALLET_ADDRESS) {
                throw new Error("Missing required environment variables: POLICY_ADDRESS or LIT_AGENT_WALLET_ADDRESS");
            }
            
            // Initialize contract instances
            this.virtualsPolicyContract = VirtualsPolicy__factory.connect(
                process.env.POLICY_ADDRESS,
                this.provider
            );
            
            this.litAgentWalletContract = LitAgentWallet__factory.connect(
                process.env.LIT_AGENT_WALLET_ADDRESS,
                this.provider
            );

            console.log("Successfully initialized contracts");
        } catch (error) {
            console.error("Failed to initialize Lit Agent Wallet:", error);
            throw error;
        }
    }
    
    async initializePKPWallet(pkpPublicKey: string) {
        if (!this.litNodeClient.ready) {
            throw new Error("Lit client not initialized");
        }
        
        const resourceAbilities = [{
            resource: new LitActionResource('*'),
            ability: LIT_ABILITY.LitActionExecution
        }];
        
        const sessionSigs = await this.litNodeClient.getSessionSigs({
            chain: "ethereum",
            expiration: new Date(Date.now() + 60_000 * 60).toISOString(),
            resourceAbilityRequests: resourceAbilities,
            authNeededCallback: async ({ resourceAbilityRequests, expiration, uri }) => {
                const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", this.provider);
                const toSign = await createSiweMessageWithRecaps({
                    uri: 'https://localhost/login',
                    expiration: expiration || new Date(Date.now() + 60_000 * 60).toISOString(),
                    resources: resourceAbilityRequests || [],
                    walletAddress: await wallet.getAddress(),
                    nonce: await this.litNodeClient.getLatestBlockhash(),
                    litNodeClient: this.litNodeClient,
                });
                
                return await generateAuthSig({
                    signer: wallet,
                    toSign,
                });
            },
        });
        
        this.pkpWallet = new PKPEthersWallet({
            pkpPubKey: pkpPublicKey,
            provider: this.provider,
            litNodeClient: this.litNodeClient,
            authContext: {
                getSessionSigsProps: {
                    chain: "ethereum",
                    resourceAbilityRequests: resourceAbilities,
                    authNeededCallback: async () => ({
                        sig: "test",
                        derivedVia: "web3.eth.personal.sign",
                        signedMessage: "test",
                        address: await this.pkpWallet?.getAddress() || ""
                    })
                }
            }
        });
        
        await this.pkpWallet.init();
        
        // Connect contracts with PKP wallet after initialization
        if (this.litAgentWalletContract && this.pkpWallet) {
            this.litAgentWalletContract = this.litAgentWalletContract.connect(this.pkpWallet);
        }
    }
    
    // Admin functions
    async setupAdmin(adminPrivateKey: string) {
        const adminWallet = new ethers.Wallet(adminPrivateKey, this.provider);
        const policyWithSigner = this.virtualsPolicyContract?.connect(adminWallet);
        if (!policyWithSigner) throw new Error("Policy contract not initialized");
        
        // Admin functions will be handled through the multisig process
        console.log("Admin setup complete. Use the multisig interface to propose and approve changes.");
    }
    
    async addDelegatee(delegateeAddress: string) {
        if (!this.virtualsPolicyContract) throw new Error("Policy contract not initialized");
        
        const tx = await this.virtualsPolicyContract.proposeDelegateeStatus(delegateeAddress, true);
        await tx.wait();
        
        console.log(`Delegatee status proposed for ${delegateeAddress}. Waiting for admin approvals.`);
    }
    
    async setToolPolicy(toolName: string, policy: ToolPolicy) {
        if (!this.virtualsPolicyContract) throw new Error("Policy contract not initialized");
        
        // Convert tool policy to on-chain parameters
        const toolId = ethers.utils.id(toolName);
        
        // Propose the policy changes through multisig
        const tx = await this.virtualsPolicyContract.proposeMaxTransactionAmount(
            ethers.utils.parseEther(policy.maxAmount)
        );
        await tx.wait();
        
        console.log(`Tool policy proposed for ${toolName}. Waiting for admin approvals.`);
    }
    
    // Execution functions
    async executeTransfer(tokenAddress: string, to: string, amount: string) {
        if (!this.pkpWallet || !this.litAgentWalletContract) {
            throw new Error("Wallet or contract not initialized");
        }
        
        const toolId = ethers.utils.id("erc20-transfer");
        const walletWithSigner = this.litAgentWalletContract.connect(this.pkpWallet);
        
        if (tokenAddress.toLowerCase() === 'eth') {
            const tx = await walletWithSigner.executeTransaction(
                to,
                ethers.utils.parseEther(amount),
                "0x",
                toolId
            );
            return await tx.wait();
        } else {
            const tx = await walletWithSigner.executeERC20Transfer(
                tokenAddress,
                to,
                ethers.utils.parseEther(amount),
                toolId
            );
            return await tx.wait();
        }
    }
    
    async executeSwap(tokenIn: string, tokenOut: string, amountIn: string) {
        if (!this.pkpWallet || !this.litAgentWalletContract) {
            throw new Error("Wallet or contract not initialized");
        }
        
        const toolId = ethers.utils.id("uniswap-swap");
        const walletWithSigner = this.litAgentWalletContract.connect(this.pkpWallet);
        
        // Implement Uniswap swap logic here
        // This is a placeholder for the actual swap implementation
        throw new Error("Swap functionality not implemented yet");
    }

    // Add this method to the VirtualsAgentWallet class
    async checkBalance(tokenAddress: string, address: string): Promise<string> {
        if (!this.pkpWallet) {
            throw new Error("Wallet not initialized");
        }

        if (tokenAddress.toLowerCase() === 'eth') {
            const balance = await this.provider.getBalance(address);
            return ethers.utils.formatEther(balance);
        } else {
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const balance = await tokenContract.balanceOf(address);
            const decimals = await tokenContract.decimals();
            return ethers.utils.formatUnits(balance, decimals);
        }
    }
}

export default VirtualsAgentWallet;