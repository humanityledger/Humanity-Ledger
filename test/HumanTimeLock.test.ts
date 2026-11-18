/**
 * HumanTimeLock.test.ts
 *
 * 100% branch coverage on:
 *   - lock() happy path + value accumulation
 *   - lock() reverts on zero value + zero duration
 *   - withdraw() before unlock time  reverts
 *   - withdraw() after unlock time  succeeds, emits event
 *   - withdraw() with no funds  reverts
 *   - Re-lock after withdraw resets state cleanly
 *   - ETH is correctly returned to caller (balance check)
 */

const { expect }   = require("chai");
const { ethers }   = require("hardhat");
const { time }     = require("@nomicfoundation/hardhat-network-helpers");

describe("HumanTimeLock", function () {
    let contract: any;
    let owner: any, user: any, stranger: any;

    const ONE_YEAR  = 365 * 24 * 60 * 60;
    const ONE_ETH   = ethers.parseEther("1");

    beforeEach(async function () {
        [owner, user, stranger] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("HumanTimeLock");
        contract = await Factory.deploy();
    });

    //  lock() 

    describe("lock()", function () {
        it("accepts ETH and emits Locked event", async function () {
            const tx = await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
            const info = await contract.locks(user.address);
            expect(info.amount).to.equal(ONE_ETH);
            await expect(tx).to.emit(contract, "Locked").withArgs(
                user.address,
                ONE_ETH,
                info.unlockTime
            );
        });

        it("accumulates multiple lock() calls", async function () {
            await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
            await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
            const info = await contract.locks(user.address);
            expect(info.amount).to.equal(ethers.parseEther("2"));
        });

        it("a later, shorter lock never shortens an earlier one (IA-05)", async function () {
            await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
            const before = (await contract.locks(user.address)).unlockTime;
            await contract.connect(user).lock(1, { value: 1n });
            const after = await contract.locks(user.address);
            expect(after.unlockTime).to.equal(before);
            await expect(contract.connect(user).withdraw()).to.be.revertedWith("Aun no es el tiempo de desbloqueo");
        });

        it("reverts with zero value", async function () {
            await expect(
                contract.connect(user).lock(ONE_YEAR, { value: 0 })
            ).to.be.revertedWith("Debe enviar valor");
        });

        it("reverts with zero duration", async function () {
            await expect(
                contract.connect(user).lock(0, { value: ONE_ETH })
            ).to.be.revertedWith("La duracion debe ser mayor a cero");
        });

        it("two different users have independent locks", async function () {
            await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
            await contract.connect(stranger).lock(ONE_YEAR, { value: ethers.parseEther("2") });

            const userInfo     = await contract.locks(user.address);
            const strangerInfo = await contract.locks(stranger.address);

            expect(userInfo.amount).to.equal(ONE_ETH);
            expect(strangerInfo.amount).to.equal(ethers.parseEther("2"));
        });
    });

    //  withdraw() 

    describe("withdraw()", function () {
        beforeEach(async function () {
            await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
        });

        it("reverts before unlock time", async function () {
            await expect(
                contract.connect(user).withdraw()
            ).to.be.revertedWith("Aun no es el tiempo de desbloqueo");
        });

        it("reverts with no locks (stranger)", async function () {
            await time.increase(ONE_YEAR + 1);
            await expect(
                contract.connect(stranger).withdraw()
            ).to.be.revertedWith("No hay fondos bloqueados");
        });

        it("succeeds after unlock time and emits Withdrawn", async function () {
            await time.increase(ONE_YEAR + 1);

            const balanceBefore = await ethers.provider.getBalance(user.address);
            const tx = await contract.connect(user).withdraw();
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * tx.gasPrice;
            const balanceAfter  = await ethers.provider.getBalance(user.address);

            // Balance increased by ~1 ETH (minus gas)
            expect(balanceAfter + gasUsed).to.be.closeTo(
                balanceBefore + ONE_ETH,
                ethers.parseEther("0.01") // 0.01 ETH tolerance
            );

            await expect(tx).to.emit(contract, "Withdrawn").withArgs(user.address, ONE_ETH);
        });

        it("zeroes out amount after withdraw (prevents re-entrancy drain)", async function () {
            await time.increase(ONE_YEAR + 1);
            await contract.connect(user).withdraw();
            const info = await contract.locks(user.address);
            expect(info.amount).to.equal(0n);
        });

        it("second withdraw of same user reverts after zeroing", async function () {
            await time.increase(ONE_YEAR + 1);
            await contract.connect(user).withdraw();
            await expect(
                contract.connect(user).withdraw()
            ).to.be.revertedWith("No hay fondos bloqueados");
        });

        it("user can re-lock after withdraw with fresh timing", async function () {
            await time.increase(ONE_YEAR + 1);
            await contract.connect(user).withdraw();

            // Re-lock for another year
            await contract.connect(user).lock(ONE_YEAR, { value: ONE_ETH });
            // Should not be withdrawable yet
            await expect(
                contract.connect(user).withdraw()
            ).to.be.revertedWith("Aun no es el tiempo de desbloqueo");
        });
    });

    //  getStatus convenience 

    describe("View - locks mapping", function () {
        it("returns zero values for address with no lock", async function () {
            const info = await contract.locks(stranger.address);
            expect(info.amount).to.equal(0n);
            expect(info.unlockTime).to.equal(0n);
        });
    });
});
