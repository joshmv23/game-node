import { ethers } from "hardhat";
import { VirtualsPolicy__factory } from "../typechain-types";

async function main() {
    const [admin] = await ethers.getSigners();
    console.log("Setting up delegatee with admin:", await admin.getAddress());

    // Get contract addresses from env
    const policyAddress = process.env.POLICY_ADDRESS;
    const llmWalletAddress = process.env.LIT_AGENT_WALLET_ADDRESS;
    
    if (!policyAddress || !llmWalletAddress) {
        throw new Error("POLICY_ADDRESS and LIT_AGENT_WALLET_ADDRESS must be set in .env");
    }

    const policy = VirtualsPolicy__factory.connect(policyAddress, admin);

    // Create proposal to add LLM wallet as delegatee
    console.log(`\nProposing delegatee status for LLM wallet: ${llmWalletAddress}`);
    try {
        const tx = await policy.proposeDelegateeStatus(llmWalletAddress, true);
        const receipt = await tx.wait();
        
        // Get proposal ID from event
        const event = receipt.events?.find(e => e.event === "ProposalCreated");
        if (event && event.args) {
            const proposalId = event.args.proposalId;
            console.log("\nProposal created successfully!");
            console.log("----------------------------------------");
            console.log("Proposal ID:", proposalId);
            console.log("Action: Add delegatee");
            console.log("Target: LLM Wallet");
            console.log("Address:", llmWalletAddress);
            console.log("----------------------------------------");
            console.log("\nTo approve this proposal, other admins should run:");
            console.log(`PROPOSAL_IDS=${proposalId} npx hardhat run scripts/approve-proposals.ts --network chronicle`);
        }
    } catch (error: any) {
        console.error("Failed to propose delegatee:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 