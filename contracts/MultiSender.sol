// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MultiSender {
    using SafeERC20 for IERC20;
    event TokensSent(address indexed token, address indexed sender, uint256 totalAmount, uint256 recipientCount);

    function sendTokens(
        address tokenAddress,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        require(recipients.length > 0, "No recipients provided");
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        IERC20 token = IERC20(tokenAddress);
        token.safeTransferFrom(msg.sender, address(this), totalAmount);
        for (uint256 i = 0; i < recipients.length; i++) {
            token.safeTransfer(recipients[i], amounts[i]);
        }
        if (token.balanceOf(address(this)) > 0) {
             token.safeTransfer(msg.sender, token.balanceOf(address(this)));
        }
        emit TokensSent(tokenAddress, msg.sender, totalAmount, recipients.length);
    }
}
