import { ethers } from "hardhat";

async function main() {
  console.log("==========================================================");
  console.log("🌌 PHASE 5: OMNIPOTENT DEPLOYMENT INITIATED 🌌");
  console.log("Target: Ethereum Appchain (Testnet)");
  console.log("Deploying 9-Layer Architecture...");
  console.log("==========================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  // 1. HumanityIdentityRegistry
  const IdentityRegistry = await ethers.getContractFactory("HumanityIdentityRegistry");
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log(`✅ [1/9] HumanityIdentityRegistry deployed at: ${identityAddr}`);

  // 2. HumanityLedgerChat
  const LedgerChat = await ethers.getContractFactory("HumanityLedgerChat");
  const chat = await LedgerChat.deploy(identityAddr);
  await chat.waitForDeployment();
  const chatAddr = await chat.getAddress();
  console.log(`✅ [2/9] HumanityLedgerChat deployed at: ${chatAddr}`);

  // 3. HumanityAcademySBT
  const AcademySBT = await ethers.getContractFactory("HumanityAcademySBT");
  const academySBT = await AcademySBT.deploy(identityAddr);
  await academySBT.waitForDeployment();
  const academySBTAddr = await academySBT.getAddress();
  console.log(`✅ [3/9] HumanityAcademySBT deployed at: ${academySBTAddr}`);

  // 4. EcosystemWarRoom
  const WarRoom = await ethers.getContractFactory("EcosystemWarRoom");
  const warRoom = await WarRoom.deploy();
  await warRoom.waitForDeployment();
  const warRoomAddr = await warRoom.getAddress();
  console.log(`✅ [4/9] EcosystemWarRoom deployed at: ${warRoomAddr}`);

  // 5. HumanityAcademyCore
  const AcademyCore = await ethers.getContractFactory("HumanityAcademyCore");
  const academyCore = await AcademyCore.deploy(identityAddr);
  await academyCore.waitForDeployment();
  const academyCoreAddr = await academyCore.getAddress();
  console.log(`✅ [5/9] HumanityAcademyCore deployed at: ${academyCoreAddr}`);

  // 6. HumanityTimeLockVault
  const Vault = await ethers.getContractFactory("HumanityTimeLockVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`✅ [6/9] HumanityTimeLockVault deployed at: ${vaultAddr}`);

  // 7. HumanityForum
  const Forum = await ethers.getContractFactory("HumanityForum");
  const forum = await Forum.deploy(identityAddr);
  await forum.waitForDeployment();
  const forumAddr = await forum.getAddress();
  console.log(`✅ [7/9] HumanityForum deployed at: ${forumAddr}`);

  // 8. HumanityQdToken
  const QdToken = await ethers.getContractFactory("HumanityQdToken");
  const qdToken = await QdToken.deploy();
  await qdToken.waitForDeployment();
  const qdTokenAddr = await qdToken.getAddress();
  console.log(`✅ [8/9] HumanityQdToken deployed at: ${qdTokenAddr}`);

  // 9. ERC-4337 Paymaster (Mock EntryPoint for now)
  const MOCK_ENTRYPOINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; // Standard ERC-4337 EntryPoint
  const Paymaster = await ethers.getContractFactory("HumanityPaymaster");
  const paymaster = await Paymaster.deploy(identityAddr, MOCK_ENTRYPOINT);
  await paymaster.waitForDeployment();
  const paymasterAddr = await paymaster.getAddress();
  console.log(`✅ [9/9] HumanityPaymaster deployed at: ${paymasterAddr}`);

  // 10. HumanityOmnichainBridge (Mock LZ Endpoint V2)
  const MOCK_LZ_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // LZ V2 Testnet Endpoint
  const Omnichain = await ethers.getContractFactory("HumanityOmnichainBridge");
  const omnichain = await Omnichain.deploy(MOCK_LZ_ENDPOINT, paymasterAddr);
  await omnichain.waitForDeployment();
  const omnichainAddr = await omnichain.getAddress();
  console.log(`✅ [10/10] HumanityOmnichainBridge deployed at: ${omnichainAddr}`);

  // 11. HumanityLedgerCore (Master Router)
  console.log("\n🔗 Initializing Core Router and Binding Ecosystem...");
  const LedgerCore = await ethers.getContractFactory("HumanityLedgerCore");
  const core = await LedgerCore.deploy();
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();

  // Register Phase 1
  const tx1 = await core.setPhase1Modules(
    identityAddr,
    paymasterAddr,
    chatAddr,
    academySBTAddr,
    warRoomAddr
  );
  await tx1.wait();

  // Register Phase 4
  const tx2 = await core.setPhase4Modules(
    omnichainAddr,
    academyCoreAddr,
    vaultAddr,
    forumAddr,
    qdTokenAddr
  );
  await tx2.wait();

  console.log(`✅ CORE ROUTER DEPLOYED & CONFIGURED AT: ${coreAddr}`);
  
  console.log("\n==========================================================");
  console.log("🚀 PHASE 5 COMPLETE: NEXT.JS ENVIRONMENT VARIABLES READY");
  console.log("==========================================================");
  console.log(`NEXT_PUBLIC_CORE_CONTRACT="${coreAddr}"`);
  console.log("==========================================================");
}

main().catch((error) => {
  console.error("FATAL ERROR IN DEPLOYMENT:", error);
  process.exitCode = 1;
});
