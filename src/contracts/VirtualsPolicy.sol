// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./VirtualsToken.sol";

contract VirtualsPolicy is Ownable, Pausable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    VirtualsToken public governanceToken;
    mapping(address => bool) public approvedDelegatees;
    mapping(bytes4 => bool) public allowedFunctions;
    mapping(address => uint256) public dailyLimits;
    mapping(address => uint256) public dailySpent;
    mapping(address => uint256) public lastResetTime;
    
    uint256 public maxTransactionAmount;
    uint256 public constant ADMIN_THRESHOLD = 2; // Number of admins required for approval
    uint256 public proposalTimeout = 1 days;
    
    EnumerableSet.AddressSet private admins;
    EnumerableSet.Bytes32Set private pendingProposals;
    
    struct Proposal {
        bytes32 id;
        address proposer;
        uint256 timestamp;
        uint256 approvals;
        bool executed;
        bytes data;
        mapping(address => bool) hasApproved;
    }
    
    mapping(bytes32 => Proposal) public proposals;
    
    event DelegateeStatusChanged(address delegatee, bool status);
    event FunctionStatusChanged(bytes4 functionSig, bool status);
    event MaxTransactionAmountChanged(uint256 newAmount);
    event AdminAdded(address admin);
    event AdminRemoved(address admin);
    event ProposalCreated(bytes32 proposalId, address proposer);
    event ProposalApproved(bytes32 proposalId, address approver);
    event ProposalExecuted(bytes32 proposalId);
    
    constructor(
        address _governanceToken,
        address initialOwner
    ) {
        governanceToken = VirtualsToken(_governanceToken);
        maxTransactionAmount = 1 ether;
        _transferOwnership(initialOwner);
        _addAdmin(initialOwner);
    }
    
    modifier onlyAdmin() {
        require(admins.contains(msg.sender), "Not an admin");
        _;
    }
    
    function _addAdmin(address admin) internal {
        admins.add(admin);
        emit AdminAdded(admin);
    }
    
    function proposeAddAdmin(address newAdmin) external onlyAdmin {
        bytes32 proposalId = keccak256(abi.encodePacked("addAdmin", newAdmin, block.timestamp));
        _createProposal(proposalId, abi.encodePacked(newAdmin));
    }
    
    function proposeRemoveAdmin(address admin) external onlyAdmin {
        require(admins.length() > ADMIN_THRESHOLD, "Cannot remove admin below threshold");
        bytes32 proposalId = keccak256(abi.encodePacked("removeAdmin", admin, block.timestamp));
        _createProposal(proposalId, abi.encodePacked(admin));
    }
    
    function _createProposal(bytes32 proposalId, bytes memory data) internal {
        require(!pendingProposals.contains(proposalId), "Proposal already exists");
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.timestamp = block.timestamp;
        proposal.data = data;
        proposal.hasApproved[msg.sender] = true;
        proposal.approvals = 1;
        
        pendingProposals.add(proposalId);
        emit ProposalCreated(proposalId, msg.sender);
    }
    
    function approveProposal(bytes32 proposalId) external onlyAdmin {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.hasApproved[msg.sender], "Already approved");
        require(!proposal.executed, "Already executed");
        require(block.timestamp <= proposal.timestamp + proposalTimeout, "Proposal expired");
        
        proposal.hasApproved[msg.sender] = true;
        proposal.approvals += 1;
        
        emit ProposalApproved(proposalId, msg.sender);
        
        if (proposal.approvals >= ADMIN_THRESHOLD) {
            _executeProposal(proposalId);
        }
    }
    
    function _executeProposal(bytes32 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        pendingProposals.remove(proposalId);
        
        bytes memory prefix = new bytes(8);
        bytes memory data = proposal.data;
        assembly {
            mstore(add(prefix, 32), mload(add(data, 32)))
        }
        
        if (keccak256(abi.encodePacked("addAdmin")) == keccak256(prefix)) {
            address newAdmin;
            assembly {
                newAdmin := mload(add(data, 40))
            }
            _addAdmin(newAdmin);
        } else if (keccak256(abi.encodePacked("removeAdmin")) == keccak256(prefix)) {
            address adminToRemove;
            assembly {
                adminToRemove := mload(add(data, 40))
            }
            admins.remove(adminToRemove);
            emit AdminRemoved(adminToRemove);
        }
        
        emit ProposalExecuted(proposalId);
    }
    
    // Governance functions (require multisig)
    function proposeDelegateeStatus(address delegatee, bool status) external onlyAdmin {
        bytes32 proposalId = keccak256(abi.encodePacked("delegatee", delegatee, status, block.timestamp));
        _createProposal(proposalId, abi.encode(delegatee, status));
    }
    
    function proposeAllowedFunction(bytes4 functionSig, bool status) external onlyAdmin {
        bytes32 proposalId = keccak256(abi.encodePacked("function", functionSig, status, block.timestamp));
        _createProposal(proposalId, abi.encode(functionSig, status));
    }
    
    function proposeMaxTransactionAmount(uint256 amount) external onlyAdmin {
        bytes32 proposalId = keccak256(abi.encodePacked("maxAmount", amount, block.timestamp));
        _createProposal(proposalId, abi.encode(amount));
    }
    
    // Policy checks
    function canExecute(
        address executor,
        bytes4 functionSig,
        uint256 amount
    ) external view whenNotPaused returns (bool) {
        // Check if executor is an approved delegatee
        if (!approvedDelegatees[executor]) {
            return false;
        }
        
        // Check if function is allowed
        if (!allowedFunctions[functionSig]) {
            return false;
        }
        
        // Check if amount is within limits
        if (amount > maxTransactionAmount) {
            return false;
        }
        
        // Check daily limits
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastReset = lastResetTime[executor] / 1 days;
        
        if (currentDay > lastReset) {
            // New day, would reset spent amount
            if (amount > dailyLimits[executor]) {
                return false;
            }
        } else {
            // Same day, check accumulated spend
            if (dailySpent[executor] + amount > dailyLimits[executor]) {
                return false;
            }
        }
        
        // Check if executor has enough delegated voting power
        uint256 votingPower = governanceToken.getVotes(executor);
        if (votingPower == 0) {
            return false;
        }
        
        return true;
    }
    
    // Emergency functions
    function pause() external onlyAdmin {
        _pause();
    }
    
    function unpause() external onlyAdmin {
        _unpause();
    }
} 