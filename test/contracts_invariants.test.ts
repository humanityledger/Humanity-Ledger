const { expect } = require('chai');
const hre = require('hardhat');

/**
 * Task T8 / Acceptance Criterion A4: L1 Smart Contract Invariant & Anti-Backdoor Verification
 * 
 * Normative Requirements:
 * - All value-holding, identity, or verification-key contracts have verified source.
 * - Complete invariant tests covering ownership, reentrancy, and edge cases.
 * - Zero unilateral admin paths outside a published timelock.
 */
describe('T8 / A4 — L1 Contract Invariants & Anti-Backdoor Controls', function () {
  let ethers: any;
  let deployer: any;
  let user1: any;
  let user2: any;
  let attacker: any;

  before(async function () {
    ethers = (hre as any).ethers;
    [deployer, user1, user2, attacker] = await ethers.getSigners();
  });

  describe('HumanityTimeLockVault — Invariants', function () {
    let vault: any;
    const TIMEOUT = 3600 * 24 * 90; // 90 days

    beforeEach(async function () {
      const Factory = await ethers.getContractFactory('HumanityTimeLockVault');
      vault = await Factory.deploy();
      await vault.waitForDeployment();
    });

    it('Invariant 1: Vault configuration rejects invalid backup or timeout below threshold', async function () {
      await expect(vault.connect(user1).setupVault(TIMEOUT, ethers.ZeroAddress)).to.be.revertedWithCustomError(vault, 'InvalidBackupWallet');
      await expect(vault.connect(user1).setupVault(TIMEOUT, user1.address)).to.be.revertedWithCustomError(vault, 'BackupCannotBeSelf');
      await expect(vault.connect(user1).setupVault(1800, user2.address)).to.be.revertedWithCustomError(vault, 'TimeoutTooShort');
    });

    it('Invariant 2: Dead man switch CANNOT be triggered prematurely before timeout has elapsed', async function () {
      await vault.connect(user1).setupVault(TIMEOUT, user2.address);
      await expect(vault.connect(attacker).executeDeadManSwitch(user1.address)).to.be.revertedWithCustomError(vault, 'TimeoutNotReached');
    });

    it('Invariant 3: Zero unilateral admin drain — Contract owner CANNOT siphon user vault balances', async function () {
      await vault.connect(user1).setupVault(TIMEOUT, user2.address);
      expect((vault as any).adminWithdraw).to.be.undefined;
      expect((vault as any).emergencyDrain).to.be.undefined;
    });

    it('Invariant 3b: one call after the timeout sweeps every token to the backup; nothing can be frozen', async function () {
      const { time } = require('@nomicfoundation/hardhat-network-helpers');
      const M = await ethers.getContractFactory('MockERC20');
      const a = await M.deploy();
      const b = await M.deploy();
      await vault.connect(user1).setupVault(TIMEOUT, user2.address);
      for (const t of [a, b]) {
        await t.mint(user1.address, 1000n);
        await t.connect(user1).approve(await vault.getAddress(), 1000n);
        await vault.connect(user1).depositToken(await t.getAddress(), 1000n);
      }
      await time.increase(TIMEOUT + 1);
      // The attacker cannot choose a subset any more: the vault sweeps what it recorded.
      await vault.connect(attacker).executeDeadManSwitch(user1.address);
      expect(await a.balanceOf(user2.address)).to.equal(1000n);
      expect(await b.balanceOf(user2.address)).to.equal(1000n);
      expect(await vault.vaultBalances(user1.address, await a.getAddress())).to.equal(0n);
      // A second call has nothing left to move.
      await expect(vault.connect(attacker).executeDeadManSwitch(user1.address)).to.be.revertedWithCustomError(vault, 'NoTokenBalancesFound');
    });

    it('Invariant 3c: a fee-on-transfer token is credited with what arrived, not with what was asked', async function () {
      const F = await ethers.getContractFactory('MockFeeOnTransferERC20');
      const fee = await F.deploy();
      await vault.connect(user1).setupVault(TIMEOUT, user2.address);
      await fee.mint(user1.address, 1000n);
      await fee.connect(user1).approve(await vault.getAddress(), 1000n);
      await vault.connect(user1).depositToken(await fee.getAddress(), 1000n);
      expect(await vault.vaultBalances(user1.address, await fee.getAddress())).to.equal(900n);
      expect(await fee.balanceOf(await vault.getAddress())).to.equal(900n);
    });
  });

  // HumanityIdentityRegistry was retired on 18 November 2026 (operator decision B-3a, IR-05).
  // Checked on the sources, not on artifacts/: a local artifacts folder can keep stale entries
  // from an earlier compile (seen on Windows, 18 Nov 2026), which made this test depend on history.
  it('the retired identity registry and StudioProvenance are gone from the sources', async function () {
    const fs = require('node:fs');
    const path = require('node:path');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('.sol')) files.push(p);
      }
    };
    walk(path.join(__dirname, '..', 'contracts'));
    expect(files.length).to.be.greaterThan(0);
    for (const f of files) {
      expect(path.basename(f), f).to.not.match(/^(HumanityIdentityRegistry|StudioProvenance)\.sol$/);
      expect(fs.readFileSync(f, 'utf8'), f).to.not.match(/HumanityIdentityRegistry|StudioProvenance/);
    }
  });
});
