// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ArcVaultAccessControl is AccessControl, Pausable {
    bytes32 public constant CFO_ROLE = keccak256("CFO_ROLE");
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
    bytes32 public constant AP_MANAGER_ROLE = keccak256("AP_MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CFO_ROLE, _admin);
    }

    function pause() external onlyRole(CFO_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(CFO_ROLE) {
        _unpause();
    }
}
