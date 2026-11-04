/**
 * Keyed deployment of the token-holding Aztec contracts (A.3). Checks against
 * the real @aztec-labs SDK and the committed artifacts, no network.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Fr } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { KEYED_ARTIFACT_PATHS, computeKeyedInstance, loadKeyedArtifact } from '../../../lib/aztec/keyed-deploy';

const root = path.resolve(__dirname, '../../..');
const artifactOf = (c: 'escrow' | 'streams') =>
  loadKeyedArtifact(JSON.parse(fs.readFileSync(path.join(root, KEYED_ARTIFACT_PATHS[c]), 'utf8')));

describe('keyed deployment (escrow, streams)', () => {
  const token = AztecAddress.fromBigInt(0x1234n);

  for (const c of ['escrow', 'streams'] as const) {
    it(`${c}: the instance commits to keys derived from the secret`, async () => {
      const artifact = artifactOf(c);
      const a = await computeKeyedInstance(artifact, { secretKey: new Fr(1n), salt: new Fr(7n), token });
      const again = await computeKeyedInstance(artifact, { secretKey: new Fr(1n), salt: new Fr(7n), token });
      const other = await computeKeyedInstance(artifact, { secretKey: new Fr(2n), salt: new Fr(7n), token });

      expect(a.instance.publicKeys.equals(a.publicKeys)).toBe(true);
      expect(a.publicKeys.isEmpty()).toBe(false);
      // Deterministic: parties can recompute the address from the shared secret.
      expect(a.instance.address.equals(again.instance.address)).toBe(true);
      // A different secret gives a different address, so a keyless or
      // differently keyed contract cannot pass as this one.
      expect(a.instance.address.equals(other.instance.address)).toBe(false);
    });
  }
});
