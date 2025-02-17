import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  paths: {
    sources: "./src/contracts",
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    chronicle: {
      url: "https://yellowstone-rpc.litprotocol.com",
      chainId: 175188,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "datil-dev": {
      url: "https://lit-protocol.calderachain.xyz/http",
      chainId: 175177,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
  },
};

export default config; 