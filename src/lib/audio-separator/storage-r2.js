// التخزين المؤقت للملفات: Cloudflare R2 (متوافق مع S3) — متغيرات R2_* الموجودة أصلًا في المشروع.
// المتصفح يرفع مباشرة إلى R2 برابط موقّع قصير العمر، فلا يمر الملف عبر دوال Vercel (حدها 4.5MB).
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, HeadBucketCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { splitStream } from './streams.js';

const PART = 8 * 1024 * 1024; // R2 يشترط أجزاءً متساوية الحجم (عدا الأخير)

export function r2Config(env = process.env) {
  const c = {
    endpoint: env.R2_ENDPOINT, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.SEPARATOR_R2_BUCKET || env.R2_BUCKET_NAME,
  };
  return c.endpoint && c.accessKeyId && c.secretAccessKey && c.bucket ? c : null;
}

export function makeR2Storage(env = process.env) {
  const cfg = r2Config(env);
  let client = null;
  const s3 = () => {
    if (!cfg) throw new Error('storage-not-configured');
    if (!client) {
      client = new S3Client({
        region: 'auto', endpoint: cfg.endpoint,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
        // إصدارات SDK الحديثة تضيف checksum افتراضيًا للروابط الموقّعة فيرفضها R2 عند الرفع من المتصفح
        requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }
    return client;
  };
  const Bucket = cfg && cfg.bucket;
  const notFound = (e) => e && (e.name === 'NotFound' || e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404));

  return {
    configured: () => !!cfg,
    presignPut: (Key, { contentType, ttlSec }) =>
      getSignedUrl(s3(), new PutObjectCommand({ Bucket, Key, ContentType: contentType }), { expiresIn: ttlSec }),
    presignGet: (Key, { ttlSec, contentType, disposition } = {}) =>
      getSignedUrl(s3(), new GetObjectCommand({
        Bucket, Key, ...(contentType ? { ResponseContentType: contentType } : {}),
        ...(disposition ? { ResponseContentDisposition: disposition } : {}),
      }), { expiresIn: ttlSec }),
    async head(Key) {
      try { const r = await s3().send(new HeadObjectCommand({ Bucket, Key })); return { size: r.ContentLength, contentType: r.ContentType }; }
      catch (e) { if (notFound(e)) return null; throw e; }
    },
    async readRange(Key, start, end) {
      const r = await s3().send(new GetObjectCommand({ Bucket, Key, Range: `bytes=${start}-${end}` }));
      return Buffer.from(await r.Body.transformToByteArray());
    },
    /** ينسخ تدفقًا (ReadableStream) إلى R2 على أجزاء ثابتة — الذاكرة المستهلكة ≈ 8MB مهما كبر الملف. */
    async putStream(Key, body, { contentType }) {
      let uploadId = null;
      const parts = [];
      try {
        await splitStream(body, PART, async (chunk, i, isLast) => {
          if (i === 0 && isLast) { await s3().send(new PutObjectCommand({ Bucket, Key, Body: chunk, ContentType: contentType })); return; }
          if (!uploadId) uploadId = (await s3().send(new CreateMultipartUploadCommand({ Bucket, Key, ContentType: contentType }))).UploadId;
          const r = await s3().send(new UploadPartCommand({ Bucket, Key, UploadId: uploadId, PartNumber: i + 1, Body: chunk }));
          parts.push({ ETag: r.ETag, PartNumber: i + 1 });
        });
        if (uploadId) await s3().send(new CompleteMultipartUploadCommand({ Bucket, Key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
      } catch (e) {
        if (uploadId) { try { await s3().send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId: uploadId })); } catch { /* */ } }
        throw e;
      }
    },
    async remove(Key) { await s3().send(new DeleteObjectCommand({ Bucket, Key })); },
    async check() { await s3().send(new HeadBucketCommand({ Bucket })); return true; },
  };
}
