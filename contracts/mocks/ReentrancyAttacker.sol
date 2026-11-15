// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ReentrancyAttacker
 * @dev Mock ERC-20 que intenta re-entrar en HumanityTimeLockVault durante
 *      una transferencia. Usado para verificar la propiedad P-TLV-05:
 *      "nonReentrant bloquea re-entrada durante el sweep".
 *
 * Creado: 15 noviembre 2026 — Hallazgo H3-04 (Fase 3).
 * Referencia: docs/l1/AUDIT_READY.md P-TLV-05, docs/l1/THREAT_MODEL.md TM-L1-01.
 *
 * SOLO PARA TESTS. No se despliega en producción ni en ninguna red pública.
 */
contract ReentrancyAttacker is ERC20 {
    address public target;      // La dirección del vault a atacar
    address public vaultOwner;  // El owner del vault (para llamar a executeDeadManSwitch)
    bool    public attackActive; // Solo ataca cuando está activo (evita loops infinitos)

    constructor() ERC20("ReentrancyToken", "RTKN") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Configura el ataque: a qué vault y en nombre de qué owner.
     */
    function setAttack(address _target, address _vaultOwner) external {
        target      = _target;
        vaultOwner  = _vaultOwner;
        attackActive = true;
    }

    function disableAttack() external {
        attackActive = false;
    }

    /**
     * @dev Override de _update (OZ 5.x): cuando el vault intenta transferir
     *      tokens a la backup wallet (from = vault, to = backupWallet),
     *      re-entra en executeDeadManSwitch.
     *
     *      Si nonReentrant funciona correctamente, la re-entrada revierte.
     *      Si no funciona, el atacante puede ejecutar el switch dos veces.
     */
    function _update(address from, address to, uint256 value) internal override {
        // Llamar primero al transfer legítimo
        super._update(from, to, value);

        // Intentar re-entrar solo cuando el vault está transfiriendo hacia afuera
        // (from == vault, to == backupWallet) y el ataque está activo
        if (attackActive && from == target && to != address(0)) {
            attackActive = false; // Prevenir loop infinito (el nonReentrant ya lo haría, pero por seguridad)
            // Re-entrada: intentar volver a llamar executeDeadManSwitch
            // Esto debe revertir con ReentrancyGuardReentrantCall si nonReentrant funciona
            (bool success,) = target.call(
                abi.encodeWithSignature("executeDeadManSwitch(address)", vaultOwner)
            );
            // success == false es el comportamiento esperado (nonReentrant bloqueó la re-entrada)
            // success == true sería una vulnerabilidad
            // El test verifica cuál de los dos ocurrió.
            if (success) {
                revert("REENTRANCY_ATTACK_SUCCEEDED: nonReentrant failed to block reentry");
            }
        }
    }
}
