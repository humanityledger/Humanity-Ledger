/**
 * ZKVerificationKeyRegistry.test.ts — master prompt task R-19.
 *
 * The registry holds the SHA-256 of each pinned binary VK. Changes are
 * timelocked, revocation is immediate, and the initial set is the one pinned
 * in lib/aztec/verifier.ts.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Same values as PINNED_VK_SHA256 in lib/aztec/verifier.ts.
const PINS: Record<string, string> = {
    escrow: "0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2",
    identity: "0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194",
    streams: "0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346",
};
const id = (c: string) => ethers.id(`hl.${c}.v1`);
const DAY = 24 * 3600;
const ACTIVE = 1n;
const REVOKED = 2n;

describe("ZKVerificationKeyRegistry", function () {
    let registry: any;
    let owner: any;
    let other: any;

    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        const F = await ethers.getContractFactory("ZKVerificationKeyRegistry");
        const names = Object.keys(PINS);
        registry = await F.deploy(owner.address, 2 * DAY, names.map(id), names.map((n) => PINS[n]));
        await registry.waitForDeployment();
    });

    it("starts with the pinned v1 VK hashes active", async function () {
        for (const [c, h] of Object.entries(PINS)) {
            const [vkHash, status] = await registry.getVK(id(c));
            expect(vkHash).to.equal(h);
            expect(status).to.equal(ACTIVE);
            expect(await registry.isAccepted(id(c), h)).to.equal(true);
        }
        expect(await registry.isAccepted(id("escrow"), PINS.identity)).to.equal(false);
    });

    it("rejects a timelock shorter than one day", async function () {
        const F = await ethers.getContractFactory("ZKVerificationKeyRegistry");
        await expect(F.deploy(owner.address, DAY - 1, [], [])).to.be.revertedWithCustomError(F, "DelayTooShort");
    });

    it("rejects duplicate or zero entries in the initial set", async function () {
        const F = await ethers.getContractFactory("ZKVerificationKeyRegistry");
        await expect(
            F.deploy(owner.address, DAY, [id("escrow"), id("escrow")], [PINS.escrow, PINS.escrow]),
        ).to.be.revertedWithCustomError(F, "DuplicateCircuit");
        await expect(F.deploy(owner.address, DAY, [id("escrow")], [ethers.ZeroHash])).to.be.revertedWithCustomError(
            F,
            "ZeroValue",
        );
        await expect(F.deploy(owner.address, DAY, [id("escrow")], [])).to.be.revertedWithCustomError(F, "LengthMismatch");
    });

    it("applies a new hash only after the timelock", async function () {
        const next = ethers.id("escrow-v1.1-vk");
        await expect(registry.proposeVK(id("escrow"), next)).to.emit(registry, "VKProposed");

        await expect(registry.executeVK(id("escrow"))).to.be.revertedWithCustomError(registry, "TimelockNotElapsed");
        expect(await registry.isAccepted(id("escrow"), PINS.escrow)).to.equal(true);

        await time.increase(2 * DAY);
        // Anyone can execute once the delay has passed.
        await expect(registry.connect(other).executeVK(id("escrow")))
            .to.emit(registry, "VKActivated")
            .withArgs(id("escrow"), next);
        expect(await registry.isAccepted(id("escrow"), next)).to.equal(true);
        expect(await registry.isAccepted(id("escrow"), PINS.escrow)).to.equal(false);
        await expect(registry.executeVK(id("escrow"))).to.be.revertedWithCustomError(registry, "NoPendingChange");
    });

    it("lets the owner cancel a pending change", async function () {
        await registry.proposeVK(id("streams"), ethers.id("x"));
        await registry.cancelVK(id("streams"));
        await time.increase(3 * DAY);
        await expect(registry.executeVK(id("streams"))).to.be.revertedWithCustomError(registry, "NoPendingChange");
        expect(await registry.isAccepted(id("streams"), PINS.streams)).to.equal(true);
    });

    it("refuses to re-propose the active hash", async function () {
        await expect(registry.proposeVK(id("identity"), PINS.identity)).to.be.revertedWithCustomError(
            registry,
            "AlreadyActive",
        );
    });

    it("revokes immediately and fails closed", async function () {
        await expect(registry.revokeVK(id("identity"))).to.emit(registry, "VKRevoked");
        const [, status] = await registry.getVK(id("identity"));
        expect(status).to.equal(REVOKED);
        expect(await registry.isAccepted(id("identity"), PINS.identity)).to.equal(false);
        await expect(registry.revokeVK(id("identity"))).to.be.revertedWithCustomError(registry, "NotActive");
    });

    it("restricts every write except executeVK to the owner", async function () {
        const r = registry.connect(other);
        await expect(r.proposeVK(id("escrow"), ethers.id("y"))).to.be.revertedWithCustomError(
            registry,
            "OwnableUnauthorizedAccount",
        );
        await expect(r.cancelVK(id("escrow"))).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
        await expect(r.revokeVK(id("escrow"))).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("transfers ownership in two steps", async function () {
        await registry.transferOwnership(other.address);
        expect(await registry.owner()).to.equal(owner.address);
        await registry.connect(other).acceptOwnership();
        expect(await registry.owner()).to.equal(other.address);
    });
});
