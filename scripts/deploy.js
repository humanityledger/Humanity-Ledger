const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    if (!deployer) {
        throw new Error(" No deployer account found! Please check your .env file and ensure PRIVATE_KEY is set and valid (starts with 0x...).");
    }
    console.log(" Deploying contracts with account:", deployer.address);

    // ---------------------------------------------------------
    // 1. DEPLOY CONDITIONAL TOKENS (CORE)
    // ---------------------------------------------------------
    // We need to check if we can get the factory directly.
    // Sometimes external artifacts are not available via getContractFactory without extra steps.
    // If this fails, we might need to use a different approach (e.g., verifying imports).
    let ConditionalTokens;
    try {
        ConditionalTokens = await hre.ethers.getContractFactory("ConditionalTokens");
    } catch (e) {
        console.log("️ Could not get factory for ConditionalTokens directly. Ensuring artifacts are present.");
        // If we can't find it, we might need to rely on importing it in a solidity file.
        throw e;
    }

    const conditionalTokens = await ConditionalTokens.deploy();
    await conditionalTokens.waitForDeployment();
    const ctAddress = await conditionalTokens.getAddress();

    console.log("\n NEXT_PUBLIC_CTF_ADDRESS:");
    console.log(ctAddress);

    // ---------------------------------------------------------
    // 2. DEPLOY FPMM FACTORY (MARKET MAKER)
    // ---------------------------------------------------------
    // The factory needs to know the ConditionalTokens address
    const FixedProductMarketMakerFactory = await hre.ethers.getContractFactory("FixedProductMarketMakerFactory");
    const fpmmFactory = await FixedProductMarketMakerFactory.deploy();
    await fpmmFactory.waitForDeployment();
    const factoryAddress = await fpmmFactory.getAddress();

    console.log("\n NEXT_PUBLIC_FPMM_FACTORY_ADDRESS:");
    console.log(factoryAddress);

    // ---------------------------------------------------------
    // 3. COLLATERAL CONFIGURATION (REAL NETWORK ASSET)
    // ---------------------------------------------------------
    const collateralAddress = process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC
    console.log("\n NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS:");
    console.log(collateralAddress);

    // ---------------------------------------------------------
    // 4. ORACLE NOTE
    // ---------------------------------------------------------
    console.log("\n️ NEXT_PUBLIC_ORACLE_ADDRESS:");
    console.log("For the oracle, you need to deploy your UMA adapter or use an existing address.");
    console.log("If you don't have the adapter yet, this step is pending.");

    console.log("\n---------------------------------------------------------");
    console.log(" DEPLOYMENT COMPLETE! Copy the values above to Railway.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
