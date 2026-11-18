/**
 * HLPortal + HLReceiver (contracts/portal) — docs/PORTAL.md, docs/RECEIVER_ADDRESSES.md.
 *
 * Happy paths (ERC-20, USDT-style, ETH; receiver forward; withdrawal with an Outbox proof),
 * caps, pause and timelock rules (I4, I5), the locked-balance invariant (I1, I2), and the
 * unlinkability properties: nothing an observer sees on Ethereum contains the Aztec account,
 * deposit messages depend on the amount only, and two receivers of one account share nothing.
 *
 * Aztec's Inbox and Outbox are mocks (contracts/mocks/MockAztecMessaging.sol) with the v6.0.0 ABI.
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { hkdfSync } = require("node:crypto");

const DAY = 24 * 60 * 60;
const TIMELOCK = 2 * DAY;
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const SECP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const coder = ethers.AbiCoder.defaultAbiCoder();

/*
 * The client formulas (lib/portal/receivers.ts), restated here with ethers so this suite runs
 * under Hardhat without loading app code. test/unit/portal/receivers.test.ts checks that the
 * client library gives exactly these values.
 */
const sha256ToField = (data: string) => "0x00" + ethers.sha256(data).slice(2, 64);
const mintToPrivateContent = (amount: bigint) =>
  sha256ToField(ethers.concat([ethers.id("mint_to_private(uint256)").slice(0, 10), coder.encode(["uint256"], [amount])]));
const withdrawContent = (recipient: string, amount: bigint, caller: string) =>
  sha256ToField(ethers.concat([ethers.id("withdraw(address,uint256,address)").slice(0, 10), coder.encode(["address", "uint256", "address"], [recipient, amount, caller])]));
const big = (b: Buffer) => BigInt("0x" + b.toString("hex"));
function derive(rootHex: string, index: number) {
  const master = Buffer.from(hkdfSync("sha256", Buffer.from(rootHex.slice(2), "hex"), "humanity-ledger/portal", "hl/portal/v1/master", 64));
  const seed = Buffer.from(hkdfSync("sha256", master, "humanity-ledger/portal", `hl/portal/v1/receiver/${index}`, 96));
  const secret = big(seed.subarray(0, 48)) % FIELD;
  const rescueKey = big(seed.subarray(48, 96)) % SECP_N;
  // Stand-in for poseidon2 on L1: the portal only checks that the secret hash is a field element.
  const secretHash = ethers.toBeHex(BigInt(ethers.keccak256(ethers.toBeHex(secret, 32))) % FIELD, 32);
  return { secret, rescueKey, secretHash, rescueSigner: ethers.computeAddress(ethers.toBeHex(rescueKey, 32)).toLowerCase() };
}
const cloneInitCode = (impl: string) => "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" + impl.slice(2).toLowerCase() + "5af43d82803e903d91602b57fd5bf3";
const L2_DAI = "0x" + "1d".repeat(32);
const L2_WETH = "0x" + "2e".repeat(32);
const L2_USDT = "0x" + "3f".repeat(32);
const VERSION = 679261766n;
const E = (n: string, d = 18) => ethers.parseUnits(n, d);

function asset(l2Token: string, o: Partial<Record<string, bigint | boolean>> = {}) {
  return {
    l2Token,
    minDeposit: o.minDeposit ?? E("1"),
    perDepositCap: o.perDepositCap ?? E("1000"),
    perSenderDailyCap: o.perSenderDailyCap ?? E("2000"),
    globalDailyCap: o.globalDailyCap ?? E("5000"),
    enabled: o.enabled ?? true,
  };
}

async function deploy() {
  const [admin, guardian, alice, bob, keeper, stranger] = await ethers.getSigners();
  const inbox = await (await ethers.getContractFactory("MockAztecInbox")).deploy();
  const outbox = await (await ethers.getContractFactory("MockAztecOutbox")).deploy();
  const weth = await (await ethers.getContractFactory("MockWETH9")).deploy();
  const dai = await (await ethers.getContractFactory("MockERC20")).deploy();
  const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy();
  const fot = await (await ethers.getContractFactory("MockFeeOnTransferERC20")).deploy();
  const portal = await (await ethers.getContractFactory("HLPortal")).deploy(
    await inbox.getAddress(),
    await outbox.getAddress(),
    VERSION,
    await weth.getAddress(),
    admin.address,
    guardian.address,
  );
  const factory = await (await ethers.getContractFactory("HLReceiverFactory")).deploy(await portal.getAddress());
  const register = async (token: string, a: any) => {
    await portal.connect(admin).queueAsset(token, a);
    await time.increase(TIMELOCK);
    await portal.connect(admin).executeAsset(token);
  };
  await register(await dai.getAddress(), asset(L2_DAI));
  await register(await weth.getAddress(), asset(L2_WETH));
  await register(await usdt.getAddress(), asset(L2_USDT, { minDeposit: 1_000000n, perDepositCap: 1000_000000n, perSenderDailyCap: 2000_000000n, globalDailyCap: 5000_000000n }));
  return { admin, guardian, alice, bob, keeper, stranger, inbox, outbox, weth, dai, usdt, fot, portal, factory, register };
}

async function lastMessage(inbox: any) {
  const n = await inbox.count();
  return inbox.messages(n - 1n);
}

const SECRET_HASH = "0x" + (123456789n).toString(16).padStart(64, "0");

describe("HLPortal", function () {
  it("message contents match the vectors pinned in the Aztec contract and the client", async function () {
    // contracts/aztec/portal_token/src/test.nr and test/unit/portal/receivers.test.ts pin the same values.
    expect(mintToPrivateContent(25000000n)).to.equal("0x00e90eec23412b6f89fb744d00d81c1153b7be8eed3b116fc650df4da1b2b8c3");
    expect(withdrawContent("0x000000000000000000000000000000000000beef", 4000n, ethers.ZeroAddress)).to.equal(
      "0x0082b27f9b81bbea08119e9875dab341b46c3899d243dd4871fcd53f4c70dc74",
    );
  });

  describe("deposits", function () {
    it("locks DAI and sends mint_to_private(amount) to the asset's Aztec token, with the secret hash and no recipient", async function () {
      const { portal, dai, inbox, alice } = await deploy();
      await dai.mint(alice.address, E("100"));
      await dai.connect(alice).approve(await portal.getAddress(), E("100"));
      await expect(portal.connect(alice).depositToAztecPrivate(await dai.getAddress(), E("40"), SECRET_HASH))
        .to.emit(portal, "DepositToAztecPrivate");
      const m = await lastMessage(inbox);
      expect(m.sender).to.equal(await portal.getAddress());
      expect(m.recipient).to.equal(L2_DAI);
      expect(m.version).to.equal(VERSION);
      expect(m.content).to.equal(mintToPrivateContent(E("40")));
      expect(m.secretHash).to.equal(SECRET_HASH);
      expect(await portal.totalLocked(await dai.getAddress())).to.equal(E("40"));
      expect(await dai.balanceOf(await portal.getAddress())).to.equal(E("40"));
    });

    it("wraps ETH and deposits it as WETH", async function () {
      const { portal, weth, inbox, alice } = await deploy();
      await portal.connect(alice).depositEthToAztecPrivate(SECRET_HASH, { value: E("2") });
      expect(await weth.balanceOf(await portal.getAddress())).to.equal(E("2"));
      expect(await portal.totalLocked(await weth.getAddress())).to.equal(E("2"));
      expect((await lastMessage(inbox)).recipient).to.equal(L2_WETH);
    });

    it("accepts a USDT-style token (no return values)", async function () {
      const { portal, usdt, alice } = await deploy();
      await usdt.mint(alice.address, 50_000000n);
      await usdt.connect(alice).approve(await portal.getAddress(), 50_000000n);
      await portal.connect(alice).depositToAztecPrivate(await usdt.getAddress(), 50_000000n, SECRET_HASH);
      expect(await portal.totalLocked(await usdt.getAddress())).to.equal(50_000000n);
    });

    it("refuses a fee-on-transfer token: the message would promise more than is locked (I1)", async function () {
      const { portal, fot, alice, register } = await deploy();
      await register(await fot.getAddress(), asset("0x" + "44".repeat(32)));
      await fot.mint(alice.address, E("100"));
      await fot.connect(alice).approve(await portal.getAddress(), E("100"));
      await expect(portal.connect(alice).depositToAztecPrivate(await fot.getAddress(), E("10"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "AmountMismatch");
    });

    it("refuses a zero or out-of-field secret hash, a zero amount, an unknown asset", async function () {
      const { portal, dai, alice, stranger } = await deploy();
      await dai.mint(alice.address, E("100"));
      await dai.connect(alice).approve(await portal.getAddress(), E("100"));
      const d = await dai.getAddress();
      await expect(portal.connect(alice).depositToAztecPrivate(d, E("5"), ethers.ZeroHash)).to.be.revertedWithCustomError(portal, "InvalidSecretHash");
      await expect(portal.connect(alice).depositToAztecPrivate(d, E("5"), ethers.toBeHex(FIELD, 32))).to.be.revertedWithCustomError(portal, "InvalidSecretHash");
      await expect(portal.connect(alice).depositToAztecPrivate(d, 0, SECRET_HASH)).to.be.revertedWithCustomError(portal, "ZeroAmount");
      await expect(portal.connect(alice).depositToAztecPrivate(stranger.address, E("5"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "AssetNotEnabled");
    });
  });

  describe("caps (I6)", function () {
    it("enforces minimum, per-deposit, per-sender daily and global daily caps, and resets each UTC day", async function () {
      const { portal, dai, alice, bob, stranger } = await deploy();
      const d = await dai.getAddress();
      for (const s of [alice, bob, stranger]) {
        await dai.mint(s.address, E("10000"));
        await dai.connect(s).approve(await portal.getAddress(), E("10000"));
      }
      await expect(portal.connect(alice).depositToAztecPrivate(d, E("0.5"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "BelowMinimum");
      await expect(portal.connect(alice).depositToAztecPrivate(d, E("1001"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "AboveDepositCap");
      await portal.connect(alice).depositToAztecPrivate(d, E("1000"), SECRET_HASH);
      await portal.connect(alice).depositToAztecPrivate(d, E("1000"), SECRET_HASH);
      expect(await portal.remainingToday(d, alice.address)).to.equal(0n);
      await expect(portal.connect(alice).depositToAztecPrivate(d, E("1"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "AboveSenderDailyCap");
      await portal.connect(bob).depositToAztecPrivate(d, E("1000"), SECRET_HASH);
      await portal.connect(bob).depositToAztecPrivate(d, E("1000"), SECRET_HASH);
      await portal.connect(stranger).depositToAztecPrivate(d, E("1000"), SECRET_HASH);
      await expect(portal.connect(stranger).depositToAztecPrivate(d, E("1"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "AboveGlobalDailyCap");
      await time.increase(DAY);
      await portal.connect(alice).depositToAztecPrivate(d, E("1000"), SECRET_HASH);
    });

    it("caps are lowered at once by the guardian, never raised that way", async function () {
      const { portal, dai, guardian } = await deploy();
      const d = await dai.getAddress();
      await expect(portal.connect(guardian).lowerCaps(d, E("10"), E("10"), E("10"))).to.emit(portal, "CapsLowered");
      await expect(portal.connect(guardian).lowerCaps(d, E("11"), E("10"), E("10"))).to.be.revertedWithCustomError(portal, "InvalidCaps");
    });

    it("IR-02: disabling an asset or lowering its caps drops a relaxation queued before it", async function () {
      const { portal, dai, admin, guardian } = await deploy();
      const d = await dai.getAddress();
      // Queued before the emergency: higher caps, enabled.
      await portal.connect(admin).queueAsset(d, asset(L2_DAI, { perDepositCap: E("1500") }));
      await expect(portal.connect(guardian).disableAsset(d)).to.emit(portal, "AssetQueueCancelled").withArgs(d);
      await time.increase(TIMELOCK);
      await expect(portal.connect(admin).executeAsset(d)).to.be.revertedWithCustomError(portal, "NothingQueued");
      expect((await portal.assets(d)).enabled).to.equal(false);

      await portal.connect(admin).queueAsset(d, asset(L2_DAI, { perDepositCap: E("1500") }));
      await time.increase(TIMELOCK);
      await portal.connect(admin).executeAsset(d);
      await portal.connect(admin).queueAsset(d, asset(L2_DAI, { perDepositCap: E("2000") }));
      await expect(portal.connect(guardian).lowerCaps(d, E("10"), E("10"), E("10"))).to.emit(portal, "AssetQueueCancelled").withArgs(d);
      await time.increase(TIMELOCK);
      await expect(portal.connect(admin).executeAsset(d)).to.be.revertedWithCustomError(portal, "NothingQueued");
      expect((await portal.assets(d)).perDepositCap).to.equal(E("10"));
    });

    it("IR-02: with nothing queued, disable and lowerCaps emit no cancellation", async function () {
      const { portal, dai, guardian } = await deploy();
      const d = await dai.getAddress();
      await expect(portal.connect(guardian).lowerCaps(d, E("10"), E("10"), E("10"))).to.not.emit(portal, "AssetQueueCancelled");
      await expect(portal.connect(guardian).disableAsset(d)).to.not.emit(portal, "AssetQueueCancelled");
    });
  });

  describe("roles and timelock (I3, I4)", function () {
    it("relaxations wait TIMELOCK; the guardian can cancel them; an asset's Aztec token never changes", async function () {
      const { portal, dai, admin, guardian, stranger } = await deploy();
      const d = await dai.getAddress();
      await portal.connect(admin).queueAsset(d, asset(L2_DAI, { perDepositCap: E("1500"), perSenderDailyCap: E("2000") }));
      await expect(portal.connect(admin).executeAsset(d)).to.be.revertedWithCustomError(portal, "TooEarly");
      await portal.connect(guardian).cancelAsset(d);
      await time.increase(TIMELOCK);
      await expect(portal.connect(admin).executeAsset(d)).to.be.revertedWithCustomError(portal, "NothingQueued");
      await expect(portal.connect(admin).queueAsset(d, asset("0x" + "99".repeat(32)))).to.be.revertedWithCustomError(portal, "AssetAlreadyBound");
      await expect(portal.connect(stranger).queueAsset(d, asset(L2_DAI))).to.be.revertedWithCustomError(portal, "NotAdmin");
      await expect(portal.connect(admin).queueAsset(d, asset(L2_DAI, { perDepositCap: E("3000") }))).to.be.revertedWithCustomError(portal, "InvalidCaps");
    });

    it("an admin change is queued, then accepted by the new admin after the delay", async function () {
      const { portal, admin, bob } = await deploy();
      await portal.connect(admin).queueAdmin(bob.address);
      await expect(portal.connect(bob).acceptAdmin()).to.be.revertedWithCustomError(portal, "TooEarly");
      await time.increase(TIMELOCK);
      await portal.connect(bob).acceptAdmin();
      expect(await portal.admin()).to.equal(bob.address);
    });

    it("has no function that moves tokens except withdraw (I2)", async function () {
      const { portal } = await deploy();
      const fns = portal.interface.fragments.filter((f: any) => f.type === "function");
      const names = fns.map((f: any) => f.name);
      for (const bad of ["sweep", "rescue", "transfer", "transferOut", "emergencyWithdraw", "upgradeTo", "upgradeToAndCall", "execute", "call", "multicall", "delegatecall"]) {
        expect(names).to.not.include(bad);
      }
      // State-changing functions that touch payouts: withdraw itself, and the bounded pause of it.
      const writes = fns.filter((f: any) => f.stateMutability !== "view" && f.stateMutability !== "pure").map((f: any) => f.name);
      expect(writes.filter((n: string) => /withdraw|transfer|sweep|rescue/i.test(n)).sort()).to.deep.equal(["pauseWithdrawals", "withdraw"]);
    });
  });

  describe("pause and sunset (I4, I5)", function () {
    it("the guardian pauses deposits at once; only the admin unpauses", async function () {
      const { portal, dai, guardian, admin, alice } = await deploy();
      await portal.connect(guardian).pauseDeposits();
      await dai.mint(alice.address, E("10"));
      await dai.connect(alice).approve(await portal.getAddress(), E("10"));
      await expect(portal.connect(alice).depositToAztecPrivate(await dai.getAddress(), E("5"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "DepositsClosed");
      await expect(portal.connect(guardian).unpauseDeposits()).to.be.revertedWithCustomError(portal, "NotAdmin");
      await portal.connect(admin).unpauseDeposits();
      await portal.connect(alice).depositToAztecPrivate(await dai.getAddress(), E("5"), SECRET_HASH);
    });

    it("withdrawals pause for at most 3 days, then not again for 4 days", async function () {
      const { portal, guardian } = await deploy();
      await expect(portal.connect(guardian).pauseWithdrawals(3 * DAY + 1)).to.be.revertedWithCustomError(portal, "PauseTooLong");
      await portal.connect(guardian).pauseWithdrawals(3 * DAY);
      await time.increase(3 * DAY);
      await expect(portal.connect(guardian).pauseWithdrawals(DAY)).to.be.revertedWithCustomError(portal, "PauseNotAllowedYet");
      await time.increase(4 * DAY);
      await portal.connect(guardian).pauseWithdrawals(DAY);
    });

    it("a sunset closes deposits forever and leaves withdrawals open", async function () {
      const f = await deploy();
      const { portal, dai, admin, alice, bob } = f;
      await dai.mint(alice.address, E("10"));
      await dai.connect(alice).approve(await portal.getAddress(), E("10"));
      await portal.connect(alice).depositToAztecPrivate(await dai.getAddress(), E("10"), SECRET_HASH);
      await portal.connect(admin).queueSunset(bob.address);
      await time.increase(TIMELOCK);
      await portal.connect(admin).executeSunset();
      await expect(portal.connect(alice).depositToAztecPrivate(await dai.getAddress(), E("1"), SECRET_HASH)).to.be.revertedWithCustomError(portal, "DepositsClosed");
      await proveWithdrawal(f, L2_DAI, bob.address, E("10"), ethers.ZeroAddress, 7n, 3n);
      await portal.connect(alice).withdraw(await dai.getAddress(), bob.address, E("10"), false, false, { epoch: 7n, numCheckpointsInEpoch: 1n, leafIndex: 3n, path: [] });
      expect(await dai.balanceOf(bob.address)).to.equal(E("10"));
    });
  });

  describe("withdrawals", function () {
    it("pays out a proven withdrawal once; refuses a replay, a wrong amount, and more than is locked (I1)", async function () {
      const f = await deploy();
      const { portal, dai, alice, bob, keeper } = f;
      const d = await dai.getAddress();
      await dai.mint(alice.address, E("100"));
      await dai.connect(alice).approve(await portal.getAddress(), E("100"));
      await portal.connect(alice).depositToAztecPrivate(d, E("100"), SECRET_HASH);
      await proveWithdrawal(f, L2_DAI, bob.address, E("30"), ethers.ZeroAddress, 1n, 0n);
      await expect(portal.connect(keeper).withdraw(d, bob.address, E("31"), false, false, { epoch: 1n, numCheckpointsInEpoch: 1n, leafIndex: 0n, path: [] })).to.be.revertedWith("Outbox: not in tree");
      await expect(portal.connect(keeper).withdraw(d, bob.address, E("30"), false, false, { epoch: 1n, numCheckpointsInEpoch: 1n, leafIndex: 0n, path: [] })).to.emit(portal, "Withdrawal");
      expect(await dai.balanceOf(bob.address)).to.equal(E("30"));
      expect(await portal.totalLocked(d)).to.equal(E("70"));
      await expect(portal.connect(keeper).withdraw(d, bob.address, E("30"), false, false, { epoch: 1n, numCheckpointsInEpoch: 1n, leafIndex: 0n, path: [] })).to.be.revertedWith("Outbox: already consumed");
      // A (hypothetically) proven message for more than is locked is refused, never paid from another asset.
      await proveWithdrawal(f, L2_DAI, bob.address, E("71"), ethers.ZeroAddress, 2n, 0n);
      await expect(portal.connect(keeper).withdraw(d, bob.address, E("71"), false, false, { epoch: 2n, numCheckpointsInEpoch: 1n, leafIndex: 0n, path: [] })).to.be.revertedWithCustomError(portal, "NotLocked");
    });

    it("a withdrawal bound to a caller can only be executed by that caller", async function () {
      const f = await deploy();
      const { portal, dai, alice, bob, keeper, stranger } = f;
      const d = await dai.getAddress();
      await dai.mint(alice.address, E("10"));
      await dai.connect(alice).approve(await portal.getAddress(), E("10"));
      await portal.connect(alice).depositToAztecPrivate(d, E("10"), SECRET_HASH);
      await proveWithdrawal(f, L2_DAI, bob.address, E("10"), keeper.address, 4n, 1n);
      await expect(portal.connect(stranger).withdraw(d, bob.address, E("10"), true, false, { epoch: 4n, numCheckpointsInEpoch: 1n, leafIndex: 1n, path: [] })).to.be.revertedWith("Outbox: not in tree");
      await portal.connect(keeper).withdraw(d, bob.address, E("10"), true, false, { epoch: 4n, numCheckpointsInEpoch: 1n, leafIndex: 1n, path: [] });
      expect(await dai.balanceOf(bob.address)).to.equal(E("10"));
    });

    it("unwraps WETH to ETH on request; refuses during a withdrawal pause", async function () {
      const f = await deploy();
      const { portal, weth, alice, bob, keeper, guardian } = f;
      await portal.connect(alice).depositEthToAztecPrivate(SECRET_HASH, { value: E("1") });
      await proveWithdrawal(f, L2_WETH, bob.address, E("1"), ethers.ZeroAddress, 5n, 0n);
      await portal.connect(guardian).pauseWithdrawals(DAY);
      await expect(portal.connect(keeper).withdraw(await weth.getAddress(), bob.address, E("1"), false, true, { epoch: 5n, numCheckpointsInEpoch: 1n, leafIndex: 0n, path: [] })).to.be.revertedWithCustomError(portal, "WithdrawalsPausedError");
      await time.increase(DAY);
      const before = await ethers.provider.getBalance(bob.address);
      await portal.connect(keeper).withdraw(await weth.getAddress(), bob.address, E("1"), false, true, { epoch: 5n, numCheckpointsInEpoch: 1n, leafIndex: 0n, path: [] });
      expect((await ethers.provider.getBalance(bob.address)) - before).to.equal(E("1"));
    });

    it("refuses plain ETH sent to it", async function () {
      const { portal, alice } = await deploy();
      await expect(alice.sendTransaction({ to: await portal.getAddress(), value: 1n })).to.be.revertedWithCustomError(portal, "UnexpectedEth");
    });
  });
});

async function proveWithdrawal(f: any, l2Token: string, recipient: string, amount: bigint, caller: string, epoch: bigint, leafIndex: bigint) {
  const { chainId } = await ethers.provider.getNetwork();
  await f.outbox.prove(l2Token, VERSION, await f.portal.getAddress(), chainId, withdrawContent(recipient, amount, caller), epoch, leafIndex);
}

describe("HLReceiver (receiver addresses)", function () {
  const ROOT = "0x" + "ab".repeat(65); // an account root (wallet signature)
  const AZTEC_ACCOUNT = "0x" + "0e3f7a".repeat(10) + "0e3f"; // the person's Aztec address, 32 bytes

  async function receiverOf(f: any, index: number, root = ROOT) {
    const m = derive(root, index);
    return { ...m, address: await f.factory.predict(m.secretHash, m.rescueSigner) };
  }

  it("the client predicts the same CREATE2 address as the factory, before deployment", async function () {
    const f = await deploy();
    const r = await receiverOf(f, 0);
    const salt = ethers.keccak256(coder.encode(["bytes32", "address"], [r.secretHash, r.rescueSigner]));
    expect(await f.factory.saltOf(r.secretHash, r.rescueSigner)).to.equal(salt);
    const local = ethers.getCreate2Address(await f.factory.getAddress(), salt, ethers.keccak256(cloneInitCode(await f.factory.implementation())));
    expect(local).to.equal(r.address);
    expect(await ethers.provider.getCode(r.address)).to.equal("0x");
  });

  it("anyone deploys and forwards: ETH, DAI and USDT become private deposits with the receiver's secret hash", async function () {
    const f = await deploy();
    const { factory, portal, inbox, dai, usdt, alice, keeper } = f;
    const r = await receiverOf(f, 0);
    await alice.sendTransaction({ to: r.address, value: E("1") });
    await dai.mint(r.address, E("25"));
    await usdt.mint(r.address, 7_000000n);
    await factory.connect(keeper).forward(r.secretHash, r.rescueSigner, ethers.ZeroAddress, E("1"));
    expect((await lastMessage(inbox)).secretHash).to.equal(r.secretHash);
    await factory.connect(keeper).forward(r.secretHash, r.rescueSigner, await dai.getAddress(), E("25"));
    await factory.connect(keeper).forward(r.secretHash, r.rescueSigner, await usdt.getAddress(), 7_000000n);
    const m = await lastMessage(inbox);
    expect(m.secretHash).to.equal(r.secretHash);
    expect(m.recipient).to.equal(L2_USDT);
    expect(await dai.allowance(r.address, await portal.getAddress())).to.equal(0n);
    expect(await usdt.allowance(r.address, await portal.getAddress())).to.equal(0n);
    expect(await portal.totalLocked(await dai.getAddress())).to.equal(E("25"));
  });

  it("only the factory initialises a receiver, once; the implementation is never usable", async function () {
    const f = await deploy();
    const r = await receiverOf(f, 0);
    await f.factory.deploy(r.secretHash, r.rescueSigner);
    const rec = await ethers.getContractAt("HLReceiver", r.address);
    await expect(rec.initialize(SECRET_HASH, f.alice.address)).to.be.revertedWithCustomError(rec, "OnlyFactory");
    expect(await rec.secretHash()).to.equal(r.secretHash);
    await f.factory.deploy(r.secretHash, r.rescueSigner); // idempotent
    const impl = await ethers.getContractAt("HLReceiver", await f.factory.implementation());
    await expect(impl.initialize(SECRET_HASH, f.alice.address)).to.be.revertedWithCustomError(impl, "OnlyFactory");
  });

  it("the receiver's daily cap applies per receiver; the rest waits on the receiver", async function () {
    const f = await deploy();
    const r = await receiverOf(f, 0);
    await f.dai.mint(r.address, E("2500"));
    await f.factory.forward(r.secretHash, r.rescueSigner, await f.dai.getAddress(), E("1000"));
    await f.factory.forward(r.secretHash, r.rescueSigner, await f.dai.getAddress(), E("1000"));
    await expect(f.factory.forward(r.secretHash, r.rescueSigner, await f.dai.getAddress(), E("500"))).to.be.revertedWithCustomError(f.portal, "AboveSenderDailyCap");
    expect(await f.dai.balanceOf(r.address)).to.equal(E("500"));
  });

  it("rescue: the receiver's own rescue key moves funds out; others, replays and late signatures are refused", async function () {
    const f = await deploy();
    const r = await receiverOf(f, 0);
    await f.factory.deploy(r.secretHash, r.rescueSigner);
    const rec = await ethers.getContractAt("HLReceiver", r.address);
    await f.dai.mint(r.address, E("9"));
    const { chainId } = await ethers.provider.getNetwork();
    const domain = { name: "Humanity Ledger receiver", version: "1", chainId, verifyingContract: r.address };
    const types = { Rescue: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] };
    const deadline = (await time.latest()) + 3600;
    const value = { token: await f.dai.getAddress(), to: f.bob.address, amount: E("9"), nonce: 0n, deadline };
    const key = new ethers.Wallet(ethers.toBeHex(r.rescueKey, 32));
    const sig = await key.signTypedData(domain, types, value);
    const wrong = await f.alice.signTypedData(domain, types, value);
    await expect(rec.rescue(value.token, value.to, value.amount, deadline, wrong)).to.be.revertedWithCustomError(rec, "BadSignature");
    await rec.connect(f.stranger).rescue(value.token, value.to, value.amount, deadline, sig);
    expect(await f.dai.balanceOf(f.bob.address)).to.equal(E("9"));
    await expect(rec.rescue(value.token, value.to, value.amount, deadline, sig)).to.be.revertedWithCustomError(rec, "BadSignature");
    const late = { ...value, nonce: 1n, deadline: (await time.latest()) - 1 };
    await expect(rec.rescue(late.token, late.to, late.amount, late.deadline, await key.signTypedData(domain, types, late))).to.be.revertedWithCustomError(rec, "Expired");
  });

  describe("unlinkability (docs/RECEIVER_ADDRESSES.md §3)", function () {
    it("no calldata, storage slot, event or message of the whole deposit path contains the Aztec account", async function () {
      const f = await deploy();
      const r = await receiverOf(f, 0);
      await f.alice.sendTransaction({ to: r.address, value: E("1") });
      const txs = [
        await f.factory.connect(f.keeper).deploy(r.secretHash, r.rescueSigner),
        await f.factory.connect(f.keeper).forward(r.secretHash, r.rescueSigner, ethers.ZeroAddress, E("1")),
      ];
      const needle = AZTEC_ACCOUNT.slice(2).toLowerCase();
      for (const tx of txs) {
        expect(tx.data.toLowerCase()).to.not.include(needle);
        const rc = await tx.wait();
        for (const log of rc.logs) {
          expect(log.data.toLowerCase()).to.not.include(needle);
          for (const t of log.topics) expect(t.toLowerCase()).to.not.include(needle);
        }
      }
      for (let slot = 0; slot < 8; slot++) {
        expect((await ethers.provider.getStorage(r.address, slot)).toLowerCase()).to.not.include(needle);
      }
      const m = await lastMessage(f.inbox);
      for (const v of [m.recipient, m.content, m.secretHash]) expect(String(v).toLowerCase()).to.not.include(needle);
    });

    it("a deposit message depends on the amount only: two people depositing the same amount send the same content", async function () {
      const f = await deploy();
      const a = await receiverOf(f, 0);
      const other = derive("0x" + "cd".repeat(65), 0);
      await f.dai.mint(a.address, E("10"));
      await f.dai.mint(await f.factory.predict(other.secretHash, other.rescueSigner), E("10"));
      await f.factory.forward(a.secretHash, a.rescueSigner, await f.dai.getAddress(), E("10"));
      const m1 = await lastMessage(f.inbox);
      await f.factory.forward(other.secretHash, other.rescueSigner, await f.dai.getAddress(), E("10"));
      const m2 = await lastMessage(f.inbox);
      expect(m1.content).to.equal(m2.content);
      expect(m1.recipient).to.equal(m2.recipient);
      expect(m1.sender).to.equal(m2.sender); // always the portal, never the receiver
    });

    it("two receivers of one account share no stored value, address or key", async function () {
      const f = await deploy();
      const r0 = await receiverOf(f, 0);
      const r1 = await receiverOf(f, 1);
      expect(r0.secretHash).to.not.equal(r1.secretHash);
      expect(r0.rescueSigner).to.not.equal(r1.rescueSigner);
      expect(r0.address).to.not.equal(r1.address);
      expect(r0.secret).to.not.equal(r1.secret);
      // Nothing of one appears in the other's material.
      const s0 = JSON.stringify([r0.secretHash, r0.rescueSigner, r0.address]).toLowerCase();
      for (const v of [r1.secretHash, r1.rescueSigner, r1.address]) expect(s0).to.not.include(String(v).slice(2, 20).toLowerCase());
    });
  });
});
