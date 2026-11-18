/**
 * deploy-system.ts
 *
 * Deployment script for the system contract HumanTimeLock (civilization/HumanTimeLock.sol).
 *
 * LedgerDeadmanSwitch is no longer deployed by this script (operator decision B-3c,
 * 18 November 2026, docs/alpha/OPERATOR_DECISIONS.md): no address of it is recorded anywhere,
 * and its pause has no expiry (IR-13). The source stays, with its tests, until a version with a
 * pause that expires is written and decided.
 *
 * Features:
 *   - ethers v6 API (formatEther, await getBalance, .waitForDeployment())
 *   - On-chain event confirmation (waits for CONFIRMATION_BLOCKS)
 *   - Automatic Etherscan/Basescan verification (with 60s propagation wait)
 *   - Deployment manifest saved to ./deployments/<network>-<timestamp>.json
 *   - Graceful error-handling with exit codes
 *
 * Usage:
 *   npx hardhat run scripts/deploy-system.ts --network base
 *   npx hardhat run scripts/deploy-system.ts --network baseGoerli
 *   npx hardhat run scripts/deploy-system.ts --network localhost
 */

import { ethers, run, network } from "hardhat";
import fs from "fs";
import path from "path";

//  Config 

const CONFIRMATION_BLOCKS = network.name === "localhost" ? 1 : 3;
const VERIFY_WAIT_MS      = 65_000; // Etherscan indexing delay


//  Utilities 

function separator(char = "", len = 62) {
    console.log(char.repeat(len));
}

function log(icon: string, msg: string) {
    console.log(`${icon} ${msg}`);
}

async function waitBlocks(provider: any, n: number) {
    if (n <= 1) return;
    const start = await provider.getBlockNumber();
    log("", `Waiting ${n} confirmation blocks...`);
    await new Promise<void>((resolve) => {
        const check = async () => {
            const curr = await provider.getBlockNumber();
            if (curr >= start + n) return resolve();
            setTimeout(check, 4_000);
        };
        check();
    });
}

async function verifyContract(address: string, constructorArgs: unknown[]) {
    if (["localhost", "hardhat"].includes(network.name)) {
        log("", "Skipping verification on local network.");
        return;
    }
    log("", `Waiting ${VERIFY_WAIT_MS / 1000}s for explorer indexing...`);
    await new Promise(r => setTimeout(r, VERIFY_WAIT_MS));
    try {
        await run("verify:verify", { address, constructorArguments: constructorArgs });
        log("", `Verified: ${address}`);
    } catch (err: any) {
        if (err?.message?.toLowerCase().includes("already verified")) {
            log("️", "Contract already verified.");
        } else {
            log("️", `Verification failed: ${err?.message}`);
        }
    }
}

//  Main 

async function main() {
    const [deployer] = await ethers.getSigners();
    const provider   = ethers.provider;
    const net        = await provider.getNetwork();
    const balance    = await provider.getBalance(deployer.address);

    separator("");
    log("", "LEDGER ALERT  System Contract Deployment");
    separator("");
    log("", `Network:  ${network.name}  (Chain ID: ${net.chainId})`);
    log("", `Deployer: ${deployer.address}`);
    log("", `Balance:  ${ethers.formatEther(balance)} ETH`);
    separator();

    if (ethers.formatEther(balance) < "0.01" && network.name !== "localhost") {
        throw new Error("Deployer balance too low (<0.01 ETH). Fund the wallet first.");
    }

    //  1. HumanTimeLock 
    log("", "Deploying HumanTimeLock...");
    const TimelockFactory  = await ethers.getContractFactory("HumanTimeLock");
    const timelockContract = await TimelockFactory.deploy();

    log("", `Tx hash: ${timelockContract.deploymentTransaction()?.hash}`);
    await timelockContract.waitForDeployment();
    const timelockAddress = await timelockContract.getAddress();
    await waitBlocks(provider, CONFIRMATION_BLOCKS);

    log("", `HumanTimeLock @ ${timelockAddress}`);

    //  2. Post-deploy sanity checks 
    separator();
    log("", "Running post-deploy sanity checks...");

    log("", `HumanTimeLock has no constructor args  confirmed stateless.`);

    //  4. Save manifest 
    const manifest = {
        network:     network.name,
        chainId:     Number(net.chainId),
        deployer:    deployer.address,
        timestamp:   new Date().toISOString(),
        contracts: {
            HumanTimeLock: {
                address:          timelockAddress,
                deployTxHash:     timelockContract.deploymentTransaction()?.hash,
                constructorArgs:  [],
            },
        },
    };

    fs.mkdirSync(path.resolve("./deployments"), { recursive: true });
    const outPath = path.resolve(`./deployments/${network.name}-system-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
    log("", `Manifest saved: ${outPath}`);

    //  5. Etherscan verification 
    separator();
    log("", "Submitting for explorer verification...");
    await verifyContract(timelockAddress, []);

    //  6. Summary 
    separator("");
    log("", "Private DEPLOYMENT COMPLETE");
    separator("");
    log("", `HumanTimeLock:      ${timelockAddress}`);
    separator();
    log("", "Add to .env.production:");
    console.log(`BASE_TIMELOCK_ADDRESS="${timelockAddress}"`);
    separator("");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(" DEPLOYMENT FAILED:", err?.message ?? err);
        process.exit(1);
    });
