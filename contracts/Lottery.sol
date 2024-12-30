// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@chainlink/contracts/src/v0.8/tests/MockV3Aggregator.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

// Author: @sukrutnrvd

contract Lottery {
    address public owner;
    uint256 public usdEntryFee = 10 * 10 ** 18; // 10 dolar, 18 desimal olarak
    address[] public participants;
    uint256 public lotteryEndTime;
    address public priceFeedAdress;
    address public lastWinner;

    AggregatorV3Interface internal ethUsdPriceFeed;

    event Entered(address indexed participant);
    event Winner(address indexed winner, uint256 amountWon);
    event LotteryReset(uint256 newDuration);

    constructor(address _priceFeedAddress, uint256 _durationInMinutes) payable {
        owner = msg.sender;
        ethUsdPriceFeed = AggregatorV3Interface(_priceFeedAddress);
        priceFeedAdress = _priceFeedAddress;
        lotteryEndTime = block.timestamp + (_durationInMinutes * 1 minutes);
    }

    receive() external payable {}

    fallback() external payable {}

    // Çekilişe katılma fonksiyonu
    function enterLottery() public payable returns (address) {
        require(block.timestamp < lotteryEndTime, "Lottery has ended");
        require(msg.sender != owner, "Owner cannot participate in the lottery");
        require(msg.value >= getEntranceFee(), "Not enough ETH to enter");
        require(
            !_alreadyParticipated(msg.sender),
            "You can only participate once"
        );
        participants.push(msg.sender);
        emit Entered(msg.sender);
        return msg.sender;
    }

    // Katılım kontrolü
    function _alreadyParticipated(
        address _participant
    ) private view returns (bool) {
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == _participant) {
                return true;
            }
        }
        return false;
    }

    // Giriş ücretini hesaplama (ETH cinsinden)
    function getEntranceFee() public view returns (uint256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        uint256 adjustedPrice = uint256(price) * 10 ** 10; // 18 desimale dönüştür
        uint256 costToEnter = (usdEntryFee * 10 ** 18) / adjustedPrice;
        return costToEnter;
    }

    function getWeiFromUsd(uint256 usdAmount) public view returns (uint256) {
        (, int256 price, , , ) = ethUsdPriceFeed.latestRoundData();
        uint256 adjustedPrice = uint256(price) * 10 ** 10; // 18 desimal
        uint256 weiAmount = (usdAmount * 10 ** 18) / adjustedPrice;
        return weiAmount;
    }

    // Kazananı seçme ve ödül verme
    function pickWinner(uint256 nextLotteryDurationInMinutes) public {
        require(msg.sender == owner, "Only the owner can pick a winner");
        require(block.timestamp >= lotteryEndTime, "Lottery is still ongoing");

        if (participants.length == 0) {
            lotteryEndTime =
                block.timestamp +
                (nextLotteryDurationInMinutes * 1 minutes);
            emit LotteryReset(lotteryEndTime);
            return;
        }

        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    participants.length
                )
            )
        ) % participants.length;
        address winner = participants[randomIndex];

        uint256 hundredUsdInWei = getWeiFromUsd(100 * 10 ** 18);

        require(
            address(this).balance >= hundredUsdInWei,
            "Not enough ETH in contract to pay 100 USD"
        );

        payable(winner).transfer(hundredUsdInWei);

        emit Winner(winner, hundredUsdInWei);

        lastWinner = winner;
        delete participants;
        lotteryEndTime =
            block.timestamp +
            (nextLotteryDurationInMinutes * 1 minutes);
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getParticipants() public view returns (address[] memory) {
        return participants;
    }

    function getLastWinner() public view returns (address) {
        return lastWinner;
    }
}
