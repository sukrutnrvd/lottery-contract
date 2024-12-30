import { ethers, network, run } from "hardhat";

async function main() {
  const isLocalNetwork = network.name === "localhost";
  const isTestNetwork = network.name === "goerli";

  console.log(`Deploying to network: ${network.name}`);

  // Mock veya gerçek fiyat beslemesi
  let priceFeedAddress: string;

  if (isLocalNetwork) {
    console.log("Local network detected.");
    console.log("Deploying MockV3Aggregator...");
    const MockV3Aggregator = await ethers.getContractFactory(
      "MockV3Aggregator"
    );
    const DECIMALS = 8;
    const INITIAL_PRICE = ethers.parseUnits("2000", DECIMALS);

    const mockPriceFeed = await MockV3Aggregator.deploy(
      DECIMALS,
      INITIAL_PRICE
    );
    await mockPriceFeed.waitForDeployment();

    priceFeedAddress = await mockPriceFeed.getAddress();
    console.log("MockV3Aggregator deployed to:", priceFeedAddress);
  } else if (isTestNetwork || network.name === "mainnet") {
    // todo: this also should be in configuration file
    priceFeedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
    console.log(`Using price feed at: ${priceFeedAddress}`);
  } else {
    throw new Error("Unsupported network");
  }

  console.log("Deploying Lottery...");
  const Lottery = await ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(
    priceFeedAddress,
    2,
    isLocalNetwork
      ? {
          value: ethers.parseEther("5"),
        }
      : {}
  );
  const deployedContract = await lottery.waitForDeployment();

  // Test ağı veya mainnet için kontratı verify etme
  if ((isTestNetwork || network.name === "mainnet") && deployedContract) {
    await deployedContract.deploymentTransaction()?.wait(5);
    console.log("Verifying contract...");
    run("verify:verify", {
      address: await lottery.getAddress(),
      constructorArguments: [priceFeedAddress, 10],
    });
  }

  console.log(
    "Lottery deployed to:",
    await lottery.getAddress(),
    "with price feed:",
    priceFeedAddress
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
