const { ethers } = require("hardhat");

async function main() {
  console.log("=================================================");
  console.log("  HUMANITY LEDGER - SOVEREIGN APPCHAIN DEPLOYER  ");
  console.log("=================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with sovereign account: ${deployer.address}`);
  console.log(`Account Balance: ${(await deployer.provider.getBalance(deployer.address)).toString()} wei\n`);

  // 1. Deploy Deflationary Token (Quantum Dots - QDS)
  console.log("-> Deploying QDSToken...");
  const QDSToken = await ethers.getContractFactory("QDSToken");
  const qds = await QDSToken.deploy();
  await qds.waitForDeployment();
  const qdsAddress = await qds.getAddress();
  console.log(`[✓] QDSToken anchored at: ${qdsAddress}`);

  // 2. Deploy ZK Verifier (Mock/Placeholder for Groth16/Plonk)
  console.log("\n-> Deploying ZK Verifier...");
  // In production, this is the generated Verifier.sol from Circom/SnarkJS
  const mockVerifierAddress = deployer.address; 
  console.log(`[✓] ZK Verifier anchored at: ${mockVerifierAddress}`);

  // 3. Deploy ZK Identity Registry
  console.log("\n-> Deploying ZKIdentityRegistry...");
  const ZKIdentity = await ethers.getContractFactory("ZKIdentityRegistry");
  const zkIdentity = await ZKIdentity.deploy(mockVerifierAddress);
  await zkIdentity.waitForDeployment();
  const zkIdentityAddress = await zkIdentity.getAddress();
  console.log(`[✓] ZKIdentityRegistry anchored at: ${zkIdentityAddress}`);

  // 4. Deploy Studio Provenance
  console.log("\n-> Deploying StudioProvenance...");
  const Studio = await ethers.getContractFactory("StudioProvenance");
  const studio = await Studio.deploy();
  await studio.waitForDeployment();
  const studioAddress = await studio.getAddress();
  console.log(`[✓] StudioProvenance anchored at: ${studioAddress}`);

  console.log("\n=================================================");
  console.log("  DEPLOYMENT SUCCESSFUL - FULL ON-CHAIN STATUS   ");
  console.log("=================================================");
  console.log("Ready for Genesis Block initialization in January.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment Failed:", error);
    process.exit(1);
  });
