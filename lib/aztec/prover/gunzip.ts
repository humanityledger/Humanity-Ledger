/**
 * gzip → bytes with the browser's native DecompressionStream (no JS inflater
 * on the heap). Falls back to pako only where the stream API is missing.
 */
export async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { ungzip } = await import('pako');
  return ungzip(data);
}
