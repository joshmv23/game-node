// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./VirtualsPolicy.sol";

contract LitAgentWallet is ReentrancyGuard {
    using Address for address;

    VirtualsPolicy public policy;
    mapping(address => uint256) public nonces;
    
    event TransactionExecuted(
        address indexed executor,
        address indexed target,
        uint256 value,
        bytes data,
        bytes32 indexed toolId
    );
    
    event TokenTransferExecuted(
        address indexed executor,
        address indexed token,
        address indexed recipient,
        uint256 amount,
        bytes32 toolId
    );
    
    constructor(address _policy) {
        policy = VirtualsPolicy(_policy);
    }
    
    // Function to receive ETH
    receive() external payable {}
    
    // Function to execute a transaction through the wallet
    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 toolId
    ) external nonReentrant returns (bool) {
        // Get function signature from data
        bytes4 functionSig;
        if (data.length >= 4) {
            assembly {
                functionSig := calldataload(data.offset)
            }
        }
        
        // Check if transaction is allowed by policy
        require(
            policy.canExecute(msg.sender, functionSig, value),
            "Transaction not allowed by policy"
        );
        
        // Execute the transaction
        (bool success, ) = target.call{value: value}(data);
        require(success, "Transaction failed");
        
        emit TransactionExecuted(msg.sender, target, value, data, toolId);
        return true;
    }
    
    // Function to execute an ERC20 transfer
    function executeERC20Transfer(
        address token,
        address recipient,
        uint256 amount,
        bytes32 toolId
    ) external nonReentrant returns (bool) {
        // Check if transfer is allowed by policy
        bytes4 transferSig = IERC20.transfer.selector;
        require(
            policy.canExecute(msg.sender, transferSig, amount),
            "Transfer not allowed by policy"
        );
        
        // Execute the transfer
        IERC20 tokenContract = IERC20(token);
        require(
            tokenContract.transfer(recipient, amount),
            "Transfer failed"
        );
        
        emit TokenTransferExecuted(msg.sender, token, recipient, amount, toolId);
        return true;
    }
    
    // Function to execute a batch of transactions
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32[] calldata toolIds
    ) external nonReentrant returns (bool[] memory) {
        require(
            targets.length == values.length &&
            values.length == datas.length &&
            datas.length == toolIds.length,
            "Array lengths must match"
        );
        
        bool[] memory results = new bool[](targets.length);
        
        for (uint256 i = 0; i < targets.length; i++) {
            // Get function signature from data
            bytes4 functionSig;
            if (datas[i].length >= 4) {
                assembly {
                    let ptr := add(datas.offset, mul(i, 0x20))
                    let offset := calldataload(ptr)
                    functionSig := calldataload(offset)
                }
            }
            
            // Check if transaction is allowed by policy
            require(
                policy.canExecute(msg.sender, functionSig, values[i]),
                "Transaction not allowed by policy"
            );
            
            // Execute the transaction
            (bool success, ) = targets[i].call{value: values[i]}(datas[i]);
            results[i] = success;
            
            if (success) {
                emit TransactionExecuted(
                    msg.sender,
                    targets[i],
                    values[i],
                    datas[i],
                    toolIds[i]
                );
            }
        }
        
        return results;
    }
    
    // Function to get the current nonce for an address
    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }
} 