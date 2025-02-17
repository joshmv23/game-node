import { ethers } from "hardhat";
import { VirtualsPolicy__factory } from "../typechain-types";

async function main() {
    const [admin] = await ethers.getSigners();
    console.log("Setting up policies with admin:", await admin.getAddress());

    // Connect to VirtualsPolicy contract
    const policyAddress = process.env.POLICY_ADDRESS;
    if (!policyAddress) {
        throw new Error("POLICY_ADDRESS not set in .env");
    }
    
    const policy = VirtualsPolicy__factory.connect(policyAddress, admin);

    // Define tools and their policies
    const tools = [
        {
            name: "erc20-transfer",
            maxAmount: ethers.utils.parseEther("1000"),
            functionSig: ethers.utils.id("transfer(address,uint256)").slice(0, 10)
        },
        {
            name: "uniswap-swap",
            maxAmount: ethers.utils.parseEther("500"),
            functionSig: ethers.utils.id("swap(address,address,uint256,uint256)").slice(0, 10)
        }
    ];

    // Create proposals for each tool
    const proposalIds = [];
    for (const tool of tools) {
        console.log(`\nCreating proposals for ${tool.name}...`);
        
        try {
            // Create function allowance proposal
            console.log("Creating function allowance proposal...");
            const allowTx = await policy.proposeAllowedFunction(tool.functionSig, true);
            const allowReceipt = await allowTx.wait();
            // Get proposal ID from event logs
            const proposalEvent = allowReceipt.events?.find(e => e.event === "ProposalCreated");
            if (proposalEvent && proposalEvent.args) {
                const proposalId = proposalEvent.args.proposalId;
                proposalIds.push({ 
                    id: proposalId, 
                    name: `${tool.name}-function`,
                    tool: tool.name
                });
                console.log(`Function allowance proposal ID: ${proposalId}`);
            }

            // Create max amount proposal
            console.log("Creating max amount proposal...");
            const amountTx = await policy.proposeMaxTransactionAmount(tool.maxAmount);
            const amountReceipt = await amountTx.wait();
            const amountEvent = amountReceipt.events?.find(e => e.event === "ProposalCreated");
            if (amountEvent && amountEvent.args) {
                const proposalId = amountEvent.args.proposalId;
                proposalIds.push({ 
                    id: proposalId, 
                    name: `${tool.name}-amount`,
                    tool: tool.name
                });
                console.log(`Max amount proposal ID: ${proposalId}`);
            }
        } catch (error: any) {
            console.error(`Failed to create proposals for ${tool.name}:`, error.message);
        }
    }

    // Print summary of all proposals that need approval
    if (proposalIds.length > 0) {
        console.log("\nProposals created and waiting for approval:");
        console.log("----------------------------------------");
        for (const proposal of proposalIds) {
            console.log(`Tool: ${proposal.tool}`);
            console.log(`Type: ${proposal.name}`);
            console.log(`Proposal ID: ${proposal.id}`);
            console.log("----------------------------------------");
        }
        console.log("\nTo approve these proposals, other admins should run:");
        console.log("npx hardhat run scripts/approve-proposals.ts --network chronicle");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 