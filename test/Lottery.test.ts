import { Lottery, MockV3Aggregator } from "../typechain-types";

import { ethers } from "hardhat";
import { expect } from "chai";

describe("Lottery Contract", function () {
  let lottery: Lottery;
  let mockPriceFeed: MockV3Aggregator;

  beforeEach(async function () {
    // Mock Price Feed'i deploy et
    const MockV3Aggregator = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const DECIMALS = 8;
    const INITIAL_PRICE = ethers.parseUnits("2000", DECIMALS);

    mockPriceFeed = await MockV3Aggregator.deploy(DECIMALS, INITIAL_PRICE);
    await mockPriceFeed.waitForDeployment();

    // Lottery kontratını deploy et
    const Lottery = await ethers.getContractFactory("Lottery");
    lottery = await Lottery.deploy(await mockPriceFeed.getAddress(), 10); // 10 dakika
    await lottery.waitForDeployment();
  });

  // Constructor testi
  it("Should set the right owner", async function () {
    const address = (await ethers.provider.getSigner(0)).address;
    expect(await lottery.owner()).to.equal(address);
  });
  it("Should set the right price feed address", async function () {
    expect(await lottery.priceFeedAdress()).to.equal(
      await mockPriceFeed.getAddress()
    );
  });
  it("Should set the right duration", async function () {
    const latest = await ethers.provider.getBlock("latest");
    const timestamp = latest?.timestamp || 0;
    const lotteryEndTime = await lottery.lotteryEndTime();
    expect(lotteryEndTime).to.equal(timestamp + 10 * 60); // 10 dakika (600 saniye)
  });

  // Enter Lottery testi
  it("Should enter the lottery", async function () {
    const address = (await ethers.provider.getSigner(1)).address;

    await lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
      value: await lottery.getEntranceFee(),
    });
    const participants = await lottery.getParticipants();
    expect(participants[0]).to.equal(address);
  });
  it("should enter only once", async function () {
    await lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
      value: await lottery.getEntranceFee(),
    });
    await expect(
      lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
        value: await lottery.getEntranceFee(),
      })
    ).to.be.revertedWith("You can only participate once");
  });
  it("should pay enought eth to enter", async function () {
    await expect(
      lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
        value: ethers.parseEther("0.0001"),
      })
    ).to.be.revertedWith("Not enough ETH to enter");
  });
  it("should revert if owner tries to enter", async function () {
    await expect(
      lottery.connect(await ethers.provider.getSigner(0)).enterLottery({
        value: await lottery.getEntranceFee(),
      })
    ).to.be.revertedWith("Owner cannot participate in the lottery");
  });
  it("should revert if lottery is over", async function () {
    await ethers.provider.send("evm_increaseTime", [601]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
        value: await lottery.getEntranceFee(),
      })
    ).to.be.revertedWith("Lottery has ended");
  });

  // Entrance Fee testi
  it("should calculate the correct entrance fee", async function () {
    // Mock fiyat beslemesi için başlangıç fiyatı
    const DECIMALS = 8;
    const INITIAL_PRICE = ethers.parseUnits("2000", DECIMALS); // 2000 USD/ETH

    // usdEntryFee (örneğin, 10 USD)
    const usdEntryFee = ethers.parseUnits("10", 18); // 10 USD (18 desimal)

    // Beklenen entranceFee'yi manuel olarak hesaplayalım
    const expectedEntranceFee =
      (usdEntryFee * 10n ** BigInt(DECIMALS)) / INITIAL_PRICE;

    // Kontrattan alınan entranceFee
    const entranceFee = await lottery.getEntranceFee();

    // Beklenen ve alınan değeri karşılaştır
    expect(entranceFee).to.equal(expectedEntranceFee);
  });

  // Pick Winner testi
  it("should pick the winner", async function () {
    const address = (await ethers.provider.getSigner(1)).address;
    await lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
      value: await lottery.getEntranceFee(),
    });
    await ethers.provider.send("evm_increaseTime", [601]);
    await ethers.provider.send("evm_mine", []);
    const nextLotteryEndTime = await lottery.lotteryEndTime();
    const lastWinner = await lottery.lastWinner();

    expect(lastWinner).to.equal(address);
  });

  it("should revert if owner tries to pick the winner", async function () {
    await lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
      value: await lottery.getEntranceFee(),
    });

    await ethers.provider.send("evm_increaseTime", [601]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lottery
        .connect(await ethers.provider.getSigner(1))
        .pickWinner(await lottery.lotteryEndTime())
    ).to.be.revertedWith("Only the owner can pick a winner");
  });

  it("should revert if lottery is not over", async function () {
    await lottery.connect(await ethers.provider.getSigner(1)).enterLottery({
      value: await lottery.getEntranceFee(),
    });
    await expect(
      lottery
        .connect(await ethers.provider.getSigner(0))
        .pickWinner(await lottery.lotteryEndTime())
    ).to.be.revertedWith("Lottery is still ongoing");
  });

  it("should revert if no one entered the lottery and should reset lottery time", async function () {
    await ethers.provider.send("evm_increaseTime", [601]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      lottery.connect(await ethers.provider.getSigner(0)).pickWinner(0)
    ).to.be.revertedWith(
      "No participants in the lottery. Lottery has been reset"
    );
  });
});
