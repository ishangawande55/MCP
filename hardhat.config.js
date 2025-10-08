import "@nomicfoundation/hardhat-toolbox";
import 'dotenv/config';

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, 
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // Example for Sepolia
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL,
    //   accounts: [process.env.PRIVATE_KEY]
    // }
  }
};