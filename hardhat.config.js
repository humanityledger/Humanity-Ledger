require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            { version: "0.8.24", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } },
            { version: "0.8.22", settings: { optimizer: { enabled: true, runs: 200 } } },
            { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },
            { version: "0.5.17", settings: { optimizer: { enabled: true, runs: 200 } } },
            { version: "0.6.12", settings: { optimizer: { enabled: true, runs: 200 } } },
        ],
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        optimismSepolia: {
            url: "https://sepolia.optimism.io",
            accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
        },
        baseSepolia: {
            url: `https://base-sepolia.infura.io/v3/${process.env.INFURA_API_KEY || ''}`,
            accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
        },
        base: {
            url: process.env.BASE_MAINNET_RPC || "https://mainnet.base.org",
            accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
        },
        worldChain: {
            url: "https://worldchain-mainnet.g.alchemy.com/public",
            chainId: 480,
            accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
        },
        optimism: {
             url: process.env.OPTIMISM_MAINNET_RPC || "https://mainnet.optimism.io",
             accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
        },
        polygonAmoy: {
            url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
            chainId: 80002,
            accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
            gasPrice: 30_000_000_000,
        },
        polygon: {
            url: process.env.POLYGON_MAINNET_RPC || "https://polygon-rpc.com",
            chainId: 137,
            accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length >= 64) ? [process.env.PRIVATE_KEY] : [],
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || process.env.POLYGONSCAN_API_KEY || "",
        customChains: [
            {
                network: "polygonAmoy",
                chainId: 80002,
                urls: {
                    apiURL:     "https://api-amoy.polygonscan.com/api",
                    browserURL: "https://amoy.polygonscan.com",
                },
            },
        ],
    },
};
