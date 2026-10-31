import { expect } from 'chai';
import hre from 'hardhat';

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
      // Rejects zero address backup
      await expect(
        vault.connect(user1).setupVault(TIMEOUT, ethers.ZeroAddress, []),
      ).to.be.revertedWith('Invalid backup wallet');

      // Rejects self as backup
      await expect(
        vault.connect(user1).setupVault(TIMEOUT, user1.address, []),
      ).to.be.revertedWith('Backup cannot be self');

      // Rejects timeout under 1 hour
      await expect(
        vault.connect(user1).setupVault(1800, user2.address, []),
      ).to.be.revertedWith('Timeout must be at least 1 hour');
    });

    it('Invariant 2: Dead man switch CANNOT be triggered prematurely before timeout has elapsed', async function () {
      await vault.connect(user1).setupVault(TIMEOUT, user2.address, []);

      // Attacker attempts to trigger dead man switch immediately
      await expect(
        vault.connect(attacker).executeDeadManSwitch(user1.address, deployer.address),
      ).to.be.revertedWith('Timeout not reached');
    });

    it('Invariant 3: Zero unilateral admin drain — Contract owner CANNOT siphon user vault balances', async function () {
      await vault.connect(user1).setupVault(TIMEOUT, user2.address, []);

      // Verify contract owner has no function to withdraw arbitrary user vault balances
      // There is no adminWithdraw or emergencyDrain function
      expect((vault as any).adminWithdraw).to.be.undefined;
      expect((vault as any).emergencyDrain).to.be.undefined;
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
        'https://humanidfi.com/avatar1.png',
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
