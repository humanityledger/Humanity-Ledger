export {
  CHUNK_PLAINTEXT,
  EXPORTER_CONTEXT,
  EXPORTER_LABEL,
  EXPORTER_LENGTH,
  MAX_FILE_BYTES,
  MAX_NOTE_BYTES,
  RECORD_SCHEME,
  RECORD_TYPE,
  RECORD_VERSION,
  ZERO_HEAD,
  RecordError,
  assertEpochSecret,
  bindFileUrl,
  encodeRecordMessage,
  handoffBody,
  isRecordMessage,
  membershipEpoch,
  normalizeMembers,
  openRecord,
  parseRecordMessage,
  recordPreview,
  seal,
  sealFileBody,
  sealHandoff,
  exporterContextFor,
  rewrapToEpoch,
  sealNote,
  setRecordCipher,
  verifyChain,
  wipeRecordKeys,
} from './protocol';

export type { EpochSecret, HandoffAction, OpenedRecord, RecordKind, RecordPointer, SealedRecord } from './protocol';

export {
  PASSPHRASE_KDF,
  RecordKeySession,
  derivePasskeyKek,
  derivePassphraseKek,
  unwrapContentKey,
  wrapContentKey,
} from './local';
export type { KdfParams, WrappedKey } from './local';

export {
  openRecord as openLegacyRecord,
  parseRecordMessage as parseLegacyMessage,
  recordPreview as legacyPreview,
  sealNote as sealLegacyNote,
} from './v1';
