/**
 * يقسّم تدفقًا (Web ReadableStream) إلى أجزاء بحجم ثابت partSize (عدا الأخير) ويستدعي onChunk(buffer, index, isLast).
 * الذاكرة المستهلكة ≈ partSize مهما كبر الملف. ملف فارغ → جزء واحد فارغ.
 */
export async function splitStream(body, partSize, onChunk) {
  const reader = body.getReader();
  let pending = [], pendingLen = 0, index = 0;
  let held = null; // جزء مكتمل ننتظر لنعرف هل هو الأخير
  const flushFull = async () => {
    while (pendingLen >= partSize) {
      const all = Buffer.concat(pending, pendingLen);
      const chunk = all.subarray(0, partSize);
      const rest = all.subarray(partSize);
      pending = rest.length ? [Buffer.from(rest)] : [];
      pendingLen = rest.length;
      if (held) await onChunk(held, index++, false);
      held = Buffer.from(chunk);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value && value.length) { pending.push(Buffer.from(value)); pendingLen += value.length; await flushFull(); }
    if (done) break;
  }
  if (pendingLen > 0) {
    if (held) await onChunk(held, index++, false);
    await onChunk(Buffer.concat(pending, pendingLen), index++, true);
  } else if (held) await onChunk(held, index++, true);
  else await onChunk(Buffer.alloc(0), index++, true);
  return index;
}
