const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SystemDeadmanSwitch", function () {
  let switchContract, mockERC20, mockERC721;
  let owner, backup, attacker;

  const TIMEOUT_DAYS = 90;
  const MIN_TIMEOUT_SEC = 90 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, backup, attacker] = await ethers.getSigners();

    // 1. Deploy Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy();

    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockERC721 = await MockERC721.deploy();

    // Mint tokens to owner
    await mockERC20.mint(owner.address, ethers.parseEther("1000"));
    await mockERC721.mint(owner.address, 1);

    // 2. Deploy Switch
    const Switch = await ethers.getContractFactory("LedgerDeadmanSwitch");
    switchContract = await Switch.deploy(owner.address, backup.address, TIMEOUT_DAYS);

    // 3. Approvals
    await mockERC20.connect(owner).approve(switchContract.target, ethers.parseEther("1000"));
    await mockERC721.connect(owner).approve(switchContract.target, 1);
  });

  describe("Initialization & Access Control", function () {
    it("Should set the correct owner and backup", async function () {
      expect(await switchContract.owner()).to.equal(owner.address);
      expect(await switchContract.backupWallet()).to.equal(backup.address);
    });

    it("Should revert if deployed with invalid timeout", async function () {
      const Switch = await ethers.getContractFactory("LedgerDeadmanSwitch");
      let reverted = false;
      try {
        await Switch.deploy(owner.address, backup.address, 89);
      } catch (err) {
        reverted = true;
        expect(err.message).to.include("TimeoutTooShort");
      }
      expect(reverted).to.be.true;
    });
  });

  describe("Ping Mechanism", function () {
    it("Should update lastPing on ping()", async function () {
      const initialPing = await switchContract.lastPing();
      await time.increase(86400); // 1 day
      await switchContract.connect(owner).ping();
      const newPing = await switchContract.lastPing();
      expect(newPing > initialPing).to.be.true;
    });

    it("Should revert if non-owner tries to ping", async function () {
      let reverted = false;
      try {
        await switchContract.connect(attacker).ping();
      } catch (err) {
        reverted = true;
        expect(err.message).to.include("OwnableUnauthorizedAccount");
      }
      expect(reverted).to.be.true;
    });
  });

  describe("Trigger Inheritance", function () {
    it("Should revert if triggered before timeout", async function () {
      let reverted = false;
      try {
        await switchContract.connect(backup).triggerInheritance(
          [mockERC20.target],
          [mockERC721.target],
          [1]
        );
      } catch (err) {
        reverted = true;
        expect(err.message).to.include("NotYetExpired");
      }
      expect(reverted).to.be.true;
    });

    it("Should successfully transfer assets after timeout", async function () {
      // Fast forward past the timeout
      await time.increase(MIN_TIMEOUT_SEC + 1);

      await switchContract.connect(attacker).triggerInheritance(
        [mockERC20.target],
        [mockERC721.target],
        [1]
      );

      // Verify transfers
      expect(await mockERC20.balanceOf(backup.address)).to.equal(ethers.parseEther("1000"));
      expect(await mockERC721.ownerOf(1)).to.equal(backup.address);
      
      // Owner balance should be 0n
      expect(await mockERC20.balanceOf(owner.address)).to.equal(0n);
    });
  });
});
