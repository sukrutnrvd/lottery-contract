import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";

const LotteryModule = buildModule("LotteryModule", (module) => {
  const DECIMALS = 8;
  const INITIAL_PRICE = ethers.parseUnits("2000", DECIMALS);
  const MockV3Aggregator = module.contract("MockV3Aggregator", [
    DECIMALS,
    INITIAL_PRICE,
  ]);

  return {
    MockV3Aggregator,
  };
});

export default LotteryModule;
