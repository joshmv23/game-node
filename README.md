# GAME Framework with Lit Protocol Integration

This project demonstrates the integration between the GAME (Goal-Oriented Autonomous Multi-Agent Execution) Framework and Lit Protocol's Agent Wallet for secure, policy-controlled blockchain operations.

## Features

- Policy-controlled blockchain operations
- Autonomous agent execution
- Secure transaction signing via Lit Protocol
- Support for transfers, swaps, and message signing
- Configurable execution policies

## Prerequisites

- Node.js v16 or higher
- npm or yarn
- A Lit Protocol account and API key
- Access to Chronicle testnet (for testing)

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd game-node
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```env
# Lit Protocol Configuration
PKP_PUBLIC_KEY=your_pkp_public_key
VIRTUALS_API_KEY=your_virtuals_api_key

# Network Configuration
RPC_URL=https://yellowstone-rpc.litprotocol.com
CHAIN_ID=175177

# Contract Addresses
POLICY_ADDRESS=your_policy_contract_address
LIT_AGENT_WALLET_ADDRESS=your_agent_wallet_address

# Test Accounts (DO NOT use production private keys)
PRIVATE_KEY=your_private_key_for_testing
PRIVATE_KEY_2=second_private_key_for_testing
```

## Project Structure

```
game-node/
├── src/
│   ├── agents/           # Agent definitions
│   ├── contracts/        # Smart contracts
│   ├── examples/         # Example implementations
│   └── workers/          # Worker implementations
├── test/                 # Test files
└── scripts/             # Deployment and utility scripts
```

## Usage

### Running Tests

```bash
# Compile contracts
npm run compile

# Run tests
npm test
```

### Running Examples

```bash
# Run the agent wallet test example
npx ts-node src/examples/agent-wallet-test.ts
```

### Deploying Contracts

```bash
# Deploy to Chronicle testnet
npx hardhat run scripts/deploy.ts --network chronicle
```

## Smart Contracts

The project includes the following smart contracts:

- `VirtualsToken`: ERC20 token with voting capabilities
- `VirtualsPolicy`: Policy management for agent operations
- `LitAgentWallet`: Agent wallet implementation

## Agent Wallet Integration

The integration with Lit Protocol's Agent Wallet provides:

1. Secure key management
2. Policy-controlled operations
3. Multi-signature support
4. Transaction execution

Example usage:

```typescript
const delegatee = await Delegatee.create(
    delegateePrivateKey,
    {
        litNetwork: "datil-dev"
    }
);

const worker = createAgentWalletWorker(delegatee);
const agent = new GameAgent(process.env.VIRTUALS_API_KEY, {
    name: "Agent Wallet Tester",
    goal: "Test agent wallet operations",
    workers: [worker],
    // ... additional configuration
});
```

## Available Operations

1. ETH Transfers
2. ERC20 Token Transfers
3. Token Swaps
4. Message Signing

Each operation is policy-controlled and executed through the Lit Protocol network.

## Development

### Adding New Operations

1. Define the operation in `src/workers/agent-wallet-worker.ts`
2. Create corresponding policy rules
3. Implement the operation logic
4. Add tests

### Modifying Policies

1. Update policy rules in `VirtualsPolicy.sol`
2. Deploy updated contract
3. Update policy address in configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Security

- Never commit private keys or sensitive information
- Use environment variables for configuration
- Follow security best practices for smart contract development
- Regularly audit dependencies

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Create an issue on GitHub
- Contact the development team
- Check documentation in `/docs`
