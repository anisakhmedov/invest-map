import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const globalForS3 = globalThis as unknown as { s3?: S3Client; s3Ready?: Promise<void> };

function config() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY and S3_BUCKET must be set");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function client() {
  if (!globalForS3.s3) {
    const c = config();
    globalForS3.s3 = new S3Client({
      endpoint: c.endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return globalForS3.s3;
}

async function ensureBucket() {
  const { bucket } = config();
  globalForS3.s3Ready ??= client()
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .then(() => undefined)
    .catch(async () => {
      await client().send(new CreateBucketCommand({ Bucket: bucket }));
    });
  try {
    await globalForS3.s3Ready;
  } catch (e) {
    globalForS3.s3Ready = undefined;
    throw e;
  }
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await ensureBucket();
  await client().send(
    new PutObjectCommand({ Bucket: config().bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string) {
  await ensureBucket();
  await client().send(new DeleteObjectCommand({ Bucket: config().bucket, Key: key }));
}

/** Opens an object as a stream so large files are never held in memory. Rejects if the key is missing. */
export async function getObject(key: string) {
  await ensureBucket();
  const res = await client().send(new GetObjectCommand({ Bucket: config().bucket, Key: key }));
  if (!res.Body) throw new Error("empty object body");
  return { stream: res.Body.transformToWebStream(), length: res.ContentLength, contentType: res.ContentType };
}

export async function readObjectBytes(key: string): Promise<Uint8Array> {
  const { stream } = await getObject(key);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
