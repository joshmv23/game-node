/// <reference types="mocha" />
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { VirtualsToken, VirtualsPolicy, LitAgentWallet } from "../typechain-types";

describe("LitAgentWallet", function () {
    let virtualToken: VirtualsToken;
    let policyContract: VirtualsPolicy;
    let walletContract: LitAgentWallet;
    let owner: SignerWithAddress;
    let admin1: SignerWithAddress;
    let admin2: SignerWithAddress;
    let delegatee: SignerWithAddress;
    let recipient: SignerWithAddress;

    beforeEach(async function () {
        // Get signers
        [owner, admin1, admin2, delegatee, recipient] = await ethers.getSigners();

        // Deploy VirtualsToken
        const VirtualsTokenFactory = await ethers.getContractFactory("VirtualsToken");
        virtualToken = (await VirtualsTokenFactory.deploy(owner.address)) as VirtualsToken;
        await virtualToken.deployed();

        // Deploy VirtualsPolicy
        const VirtualsPolicyFactory = await ethers.getContractFactory("VirtualsPolicy");
        policyContract = (await VirtualsPolicyFactory.deploy(virtualToken.address, owner.address)) as VirtualsPolicy;
        await policyContract.deployed();

        // Deploy LitAgentWallet
        const LitAgentWalletFactory = await ethers.getContractFactory("LitAgentWallet");
        walletContract = (await LitAgentWalletFactory.deploy(policyContract.address)) as LitAgentWallet;
        await walletContract.deployed();

        // Add admin1 as an admin first
        const addAdmin1Tx = await policyContract.proposeAddAdmin(admin1.address);
        const admin1Receipt = await addAdmin1Tx.wait();
        
        // Get the proposal ID from the event in this transaction
        const admin1ProposalId = admin1Receipt.events?.find(
            e => e.event === "ProposalCreated"
        )?.args?.proposalId;

        // Owner approves admin1's proposal
        await policyContract.approveProposal(admin1ProposalId);

        // Now admin1 is an admin and can propose admin2
        const addAdmin2Tx = await policyContract.connect(admin1).proposeAddAdmin(admin2.address);
        const admin2Receipt = await addAdmin2Tx.wait();
        
        // Get admin2's proposal ID from this transaction's event
        const admin2ProposalId = admin2Receipt.events?.find(
            e => e.event === "ProposalCreated"
        )?.args?.proposalId;
        
        // Owner approves admin2's proposal
        await policyContract.approveProposal(admin2ProposalId);

        // Set up policy permissions for delegatee
        const tx = await policyContract.connect(admin1).proposeDelegateeStatus(delegatee.address, true);
        const receipt = await tx.wait();
        
        const delegateeProposalId = receipt.events?.find(
            e => e.event === "ProposalCreated"
        )?.args?.proposalId;
        
        // Admin2 approves delegatee addition
        await policyContract.connect(admin2).approveProposal(delegateeProposalId);
    });

    describe("Basic Functionality", function () {
        it("Should set correct initial values", async function () {
            expect(await walletContract.policy()).to.equal(policyContract.address);
        });

        it("Should accept ETH deposits", async function () {
            const depositAmount = ethers.utils.parseEther("1.0");
            await owner.sendTransaction({
                to: walletContract.address,
                value: depositAmount
            });

            const balance = await ethers.provider.getBalance(walletContract.address);
            expect(balance).to.equal(depositAmount);
        });
    });

    describe("Transaction Execution", function () {
        beforeEach(async function () {
            // Fund the wallet with some ETH
            await owner.sendTransaction({
                to: walletContract.address,
                value: ethers.utils.parseEther("2.0")
            });

            // Set up allowed functions in policy
            const transferSig = ethers.utils.id("transfer(address,uint256)").slice(0, 10);
            const tx = await policyContract.connect(admin1).proposeAllowedFunction(transferSig, true);
            const receipt = await tx.wait();
            
            const proposalId = receipt.events?.find(
                e => e.event === "ProposalCreated"
            )?.args?.proposalId;
            
            // Admin2 approves function allowance
            await policyContract.connect(admin2).approveProposal(proposalId);
        });

        it("Should execute ETH transfer when policy allows", async function () {
            const transferAmount = ethers.utils.parseEther("0.1");
            const initialBalance = await recipient.getBalance();

            const tx = await walletContract.connect(delegatee).executeTransaction(
                recipient.address,
                transferAmount,
                "0x",
                ethers.utils.id("eth-transfer")
            );
            await tx.wait();

            const finalBalance = await recipient.getBalance();
            expect(finalBalance.sub(initialBalance)).to.equal(transferAmount);
        });

        it("Should execute ERC20 transfer when policy allows", async function () {
            // First transfer some tokens to the wallet
            const tokenAmount = ethers.utils.parseEther("100");
            await virtualToken.transfer(walletContract.address, tokenAmount);

            const tx = await walletContract.connect(delegatee).executeERC20Transfer(
                virtualToken.address,
                recipient.address,
                ethers.utils.parseEther("10"),
                ethers.utils.id("erc20-transfer")
            );
            await tx.wait();

            const recipientBalance = await virtualToken.balanceOf(recipient.address);
            expect(recipientBalance).to.equal(ethers.utils.parseEther("10"));
        });
    });
}); 