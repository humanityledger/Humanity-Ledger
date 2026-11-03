/**
 * ZKIdentityRegistry.test.ts — master prompt task R-05.
 *
 * `verifyCredential` used to emit `CredentialVerified` for any proof because the
 * verifier call was commented out. It must refuse every credential until a real
 * verifier is connected.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKIdentityRegistry", function () {
    let registry: any;
    let user: any;

    beforeEach(async function () {
        [user] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("ZKIdentityRegistry");
        registry = await Factory.deploy(ethers.ZeroAddress);
        await registry.waitForDeployment();
        await registry.connect(user).anchorIdentity(ethers.id("root"));
    });

    it("rejects a credential with an empty proof", async function () {
        await expect(
            registry.connect(user).verifyCredential(ethers.id("over-18"), "0x", [])
        ).to.be.revertedWithCustomError(registry, "VerifierNotConnected");
    });

    it("rejects a credential with arbitrary proof bytes", async function () {
        await expect(
            registry.connect(user).verifyCredential(ethers.id("over-18"), "0xdeadbeef", [ethers.id("x")])
        ).to.be.revertedWithCustomError(registry, "VerifierNotConnected");
    });

    it("still anchors and rotates identity roots", async function () {
        expect(await registry.identityRoots(user.address)).to.equal(ethers.id("root"));
        await registry.connect(user).rotateIdentityRoot(ethers.id("root-2"));
        expect(await registry.identityRoots(user.address)).to.equal(ethers.id("root-2"));
    });
});
