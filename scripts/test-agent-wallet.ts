import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { PKPEthersWallet } from '@lit-protocol/pkp-ethers';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { VirtualsPolicy__factory } from '../typechain-types';
import { LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from '@lit-protocol/auth-helpers';
import { LIT_ABILITY } from '@lit-protocol/constants';

dotenv.config();

async function main() {
    console.log("Testing Agent Wallet Integration...");

    // Initialize Lit Node Client
    const litNodeClient = new LitNodeClient({
        litNetwork: "datil-dev",
        debug: false
    });

    try {
        // Connect to Lit Network
        console.log("\nConnecting to Lit Network...");
        await litNodeClient.connect();
        console.log("✓ Connected to Lit Network");

        // Verify PKP public key
        const pkpPublicKey = process.env.PKP_PUBLIC_KEY;
        if (!pkpPublicKey) {
            throw new Error("PKP_PUBLIC_KEY not found in .env");
        }
        console.log("\nPKP Public Key:", pkpPublicKey);

        // Setup authentication
        const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);

        const resourceAbilities = [{
            resource: new LitActionResource('*'),
            ability: LIT_ABILITY.LitActionExecution
        }];

        const sessionSigs = await litNodeClient.getSessionSigs({
            chain: "ethereum",
            expiration: new Date(Date.now() + 60_000 * 60).toISOString(), // 1 hour
            resourceAbilityRequests: resourceAbilities,
            authNeededCallback: async ({ resourceAbilityRequests, expiration, uri }) => {
                const siweMessage = await createSiweMessageWithRecaps({
                    uri: 'https://localhost/login',
                    expiration: expiration || new Date(Date.now() + 60_000 * 60).toISOString(),
                    resources: resourceAbilityRequests || [],
                    walletAddress: await wallet.getAddress(),
                    nonce: await litNodeClient.getLatestBlockhash(),
                    litNodeClient,
                });

                return await generateAuthSig({
                    signer: wallet,
                    toSign: siweMessage,
                });
            },
        });

        // Initialize PKP wallet with auth context
        console.log("\nInitializing PKP wallet...");
        const pkpWallet = new PKPEthersWallet({
            pkpPubKey: pkpPublicKey,
            provider,
            litNodeClient,
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

        await pkpWallet.init();
        console.log("✓ PKP wallet initialized");

        // Get wallet address
        const walletAddress = await pkpWallet.getAddress();
        console.log("Wallet address:", walletAddress);

        // Check wallet balance
        const balance = await provider.getBalance(walletAddress);
        console.log("Wallet balance:", ethers.utils.formatEther(balance), "ETH");

        // Verify Policy Contract
        const policyAddress = process.env.POLICY_ADDRESS;
        if (!policyAddress) {
            throw new Error("POLICY_ADDRESS not found in .env");
        }
        console.log("\nVerifying Policy Contract...");
        const policy = VirtualsPolicy__factory.connect(policyAddress, pkpWallet);
        
        // Check if wallet is an approved delegatee
        const isDelegatee = await policy.approvedDelegatees(walletAddress);
        console.log("Is approved delegatee:", isDelegatee);

        // Check allowed functions
        const transferFunctionSig = ethers.utils.id("transfer(address,uint256)").slice(0, 10);
        const isTransferAllowed = await policy.allowedFunctions(transferFunctionSig);
        console.log("Transfer function allowed:", isTransferAllowed);

        console.log("\n✓ Integration test completed successfully");

    } catch (error: any) {
        console.error("\nError during integration test:", error.message);
        if (error.info) {
            console.error("Additional error info:", error.info);
        }
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });