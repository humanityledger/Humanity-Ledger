'use client';

import React from 'react';
import { ZkWalletPanel } from './ZkWalletPanel';

/**
 * ZkShieldModal — adaptador de shield / unshield.
 *
 * La versión anterior enviaba fondos directamente al bridge retirado de Aztec
 * Connect (0x737901bea3eeb88459df9ef1BE8fF3Ae1B42A2ba), dirección irrecuperable.
 * Esta versión es un adaptador delgado que delega al flujo real de ZkWalletPanel,
 * el cual utiliza el PXE de Aztec v6 con cifrado OPFS y proving local.
 */

interface ZkShieldModalProps {
  address: string;
  mode: 'shield' | 'unshield';
  onClose: () => void;
  onSuccess?: () => void;
}

export function ZkShieldModal({ address, mode, onClose, onSuccess }: ZkShieldModalProps) {
  return (
    <ZkWalletPanel
      address={address}
      initialSheet={mode}
      onClose={onClose}
      onPaymentSent={onSuccess}
    />
  );
}
