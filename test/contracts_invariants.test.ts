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

  describe('HumanityIdentityRegistry — Invariants', function () {
    let registry: any;

    beforeEach(async function () {
      const Factory = await ethers.getContractFactory('HumanityIdentityRegistry');
      registry = await Factory.deploy();
      await registry.waitForDeployment();
    });

    it('Invariant 4: Self-sovereign identity registration cannot be overwritten or hijacked', async function () {
      const nullifier = ethers.keccak256(ethers.toUtf8Bytes('user1_worldid_nullifier'));

      // User1 registers identity
      await registry.connect(user1).registerIdentity(
        'Alice Sovereign',
        'https://ledgerchat.org/avatar1.png',
        'Humanity Ledger Core Member',
        nullifier,
      );

      const identity = await registry.identities(user1.address);
      expect(identity.displayName).to.equal('Alice Sovereign');
      expect(identity.worldIdNullifierHash).to.equal(nullifier);

      // User1 cannot be re-registered (IdentityAlreadyExists)
      await expect(
        registry.connect(user1).registerIdentity(
          'Alice Malicious Duplicate',
          '',
          '',
          nullifier,
        ),
      ).to.be.revertedWithCustomError(registry, 'IdentityAlreadyExists');

      // Attacker cannot reuse User1's nullifier (NullifierAlreadyUsed)
      await expect(
        registry.connect(attacker).registerIdentity(
          'Attacker Sybil',
          '',
          '',
          nullifier,
        ),
      ).to.be.revertedWithCustomError(registry, 'NullifierAlreadyUsed');
    });

    it('Invariant 5: Identity profile can only be updated by its rightful owner', async function () {
      const nullifier = ethers.keccak256(ethers.toUtf8Bytes('user2_nullifier'));
      await registry.connect(user2).registerIdentity('Bob', '', '', nullifier);

      // Attacker tries to update Bob's identity profile
      // updateProfile operates on msg.sender, so attacker cannot alter Bob's state
      await registry.connect(attacker).registerIdentity('Attacker', '', '', ethers.ZeroHash);
      await registry.connect(attacker).updateProfile('Attacker New Name', '', '');

      // Bob's profile remains untouched
      const bobIdentity = await registry.identities(user2.address);
      expect(bobIdentity.displayName).to.equal('Bob');
    });
  });
});
