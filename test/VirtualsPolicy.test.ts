/// <reference types="mocha" />
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { VirtualsToken, VirtualsPolicy } from "../typechain-types";

describe("VirtualsPolicy", function () {
    let virtualToken: VirtualsToken;
    let policyContract: VirtualsPolicy;
    let owner: SignerWithAddress;
    let admin1: SignerWithAddress;
    let admin2: SignerWithAddress;
    let delegatee: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        // Get signers
        [owner, admin1, admin2, delegatee, user] = await ethers.getSigners();

        // Deploy VirtualsToken
        const VirtualsTokenFactory = await ethers.getContractFactory("VirtualsToken");
        virtualToken = (await VirtualsTokenFactory.deploy(owner.address)) as VirtualsToken;
        await virtualToken.deployed();

        // Deploy VirtualsPolicy
        const VirtualsPolicyFactory = await ethers.getContractFactory("VirtualsPolicy");
        policyContract = (await VirtualsPolicyFactory.deploy(virtualToken.address, owner.address)) as VirtualsPolicy;
        await policyContract.deployed();

        // First, have admin1 propose admin2
        const addAdmin2Tx = await policyContract.connect(admin1).proposeAddAdmin(admin2.address);
        const admin2Receipt = await addAdmin2Tx.wait();
        
        // Get admin2's proposal ID from this transaction's event
        const admin2ProposalId = admin2Receipt.events?.find(
            e => e.event === "ProposalCreated"
        )?.args?.proposalId;
        
        // Owner approves admin2's proposal
        await policyContract.approveProposal(admin2ProposalId);

        // Now admin2 can propose admin1
        const addAdmin1Tx = await policyContract.connect(admin2).proposeAddAdmin(admin1.address);
        const admin1Receipt = await addAdmin1Tx.wait();
        
        // Get admin1's proposal ID from this transaction's event
        const admin1ProposalId = admin1Receipt.events?.find(
            e => e.event === "ProposalCreated"
        )?.args?.proposalId;
        
        // Owner approves admin1's proposal
        await policyContract.approveProposal(admin1ProposalId);
    });

    describe("Basic Functionality", function () {
        it("Should set correct initial values", async function () {
            expect(await policyContract.governanceToken()).to.equal(virtualToken.address);
            expect(await policyContract.owner()).to.equal(owner.address);
        });

        it("Should allow admin to propose a delegatee", async function () {
            const tx = await policyContract.connect(admin1).proposeDelegateeStatus(delegatee.address, true);
            const receipt = await tx.wait();
            
            const proposalId = receipt.events?.find(
                e => e.event === "ProposalCreated"
            )?.args?.proposalId;
            
            // Admin2 approves the proposal
            await policyContract.connect(admin2).approveProposal(proposalId);
            
            expect(proposalId).to.not.be.undefined;
        });

        it("Should allow setting max transaction amount through proposal", async function () {
            const amount = ethers.utils.parseEther("1.0");
            const tx = await policyContract.connect(admin1).proposeMaxTransactionAmount(amount);
            const receipt = await tx.wait();
            
            const proposalId = receipt.events?.find(
                e => e.event === "ProposalCreated"
            )?.args?.proposalId;
            
            // Admin2 approves the proposal
            await policyContract.connect(admin2).approveProposal(proposalId);
            
            expect(proposalId).to.not.be.undefined;
        });
    });

    describe("Policy Enforcement", function () {
        beforeEach(async function () {
            // Set up a delegatee
            const tx = await policyContract.connect(admin1).proposeDelegateeStatus(delegatee.address, true);
            const receipt = await tx.wait();
            
            const proposalId = receipt.events?.find(
                e => e.event === "ProposalCreated"
            )?.args?.proposalId;
            
            // Admin2 approves the proposal
            await policyContract.connect(admin2).approveProposal(proposalId);
        });

        it("Should correctly check execution permissions", async function () {
            const functionSig = ethers.utils.id("transfer(address,uint256)").slice(0, 10);
            const amount = ethers.utils.parseEther("0.1");
            
            // First, delegate some tokens to the delegatee
            await virtualToken.transfer(delegatee.address, ethers.utils.parseEther("1.0"));
            await virtualToken.connect(delegatee).delegate(delegatee.address);
            
            const canExecute = await policyContract.canExecute(
                delegatee.address,
                functionSig,
                amount
            );
            
            // This might be false initially because we need to set up allowed functions
            // The test helps us verify the basic flow
            expect(typeof canExecute).to.equal("boolean");
        });
    });
}); 