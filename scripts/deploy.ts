const { ethers } = require("hardhat");
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with account:", await deployer.getAddress());
    
    // Deploy VirtualsToken
    console.log("\nDeploying VirtualsToken...");
    const VirtualsTokenFactory = await ethers.getContractFactory("VirtualsToken");
    const token = await VirtualsTokenFactory.deploy(deployer.address);
    await token.deployed();
    console.log("VirtualsToken deployed to:", token.address);
    
    // Deploy VirtualsPolicy
    console.log("\nDeploying VirtualsPolicy...");
    const VirtualsPolicyFactory = await ethers.getContractFactory("VirtualsPolicy");
    const policy = await VirtualsPolicyFactory.deploy(token.address, deployer.address);
    await policy.deployed();
    console.log("VirtualsPolicy deployed to:", policy.address);
    
    // Deploy LitAgentWallet
    console.log("\nDeploying LitAgentWallet...");
    const LitAgentWalletFactory = await ethers.getContractFactory("LitAgentWallet");
    const wallet = await LitAgentWalletFactory.deploy(policy.address);
    await wallet.deployed();
    console.log("LitAgentWallet deployed to:", wallet.address);
    
    // Setup initial configuration
    console.log("\nSetting up initial configuration...");
    
    // Add additional admins (if specified in env)
    if (process.env.ADMIN_ADDRESSES) {
        const adminAddresses = process.env.ADMIN_ADDRESSES.split(',');
        for (const adminAddress of adminAddresses) {
            console.log(`Proposing to add admin: ${adminAddress}`);
            const tx = await policy.proposeAddAdmin(adminAddress);
            await tx.wait();
            console.log("Admin addition proposed");
        }
    }
    
    // Set up initial allowed functions
    const functionSignatures = [
        "transfer(address,uint256)",
        "approve(address,uint256)",
        "swap(address,address,uint256,uint256)",
    ];
    
    for (const signature of functionSignatures) {
        const functionSig = ethers.utils.id(signature).slice(0, 10);
        console.log(`Proposing to allow function: ${signature}`);
        const tx = await policy.proposeAllowedFunction(functionSig, true);
        await tx.wait();
        console.log("Function allowance proposed");
    }
    
    // Set initial transaction limits
    console.log("\nProposing transaction limits...");
    const maxTxAmount = ethers.utils.parseEther("10"); // 10 ETH max per transaction
    const tx = await policy.proposeMaxTransactionAmount(maxTxAmount);
    await tx.wait();
    console.log("Transaction limit proposed");
    
    console.log("\nDeployment complete! Contract addresses:");
    console.log("VirtualsToken:", token.address);
    console.log("VirtualsPolicy:", policy.address);
    console.log("LitAgentWallet:", wallet.address);
    
    console.log("\nNext steps:");
    console.log("1. Additional admins need to approve the pending proposals");
    console.log("2. Set up the LLM wallet address as a delegatee");
    console.log("3. Configure specific tool policies for the LLM");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });