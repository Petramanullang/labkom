import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveConfig = {
  folderId: string;
  subfolder: string | null;
  anyoneReader: boolean;
};

export type UploadedProof = {
  fileId: string;
  name: string;
  size: number | null;
  url: string;
};

export class DriveError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "upload_failed"
      | "read_failed"
      | "delete_failed",
  ) {
    super(message);
    this.name = "DriveError";
  }
}

export function driveConfig(): DriveConfig | null {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

  if (!folderId) {
    return null;
  }

  return {
    folderId,

    subfolder: process.env.GOOGLE_DRIVE_SUBFOLDER?.trim() || null,

    anyoneReader: process.env.GOOGLE_DRIVE_ANYONE_READER?.trim() === "true",
  };
}

export function isDriveConfigured(): boolean {
  return driveConfig() !== null;
}

export function proofStorageMode(): "google_drive" | "supabase" {
  const value = process.env.PAYMENT_PROOF_STORAGE?.trim().toLowerCase();

  if (value === "supabase") {
    return "supabase";
  }

  return "google_drive";
}

let cachedClient: drive_v3.Drive | null = null;

function driveClient(): drive_v3.Drive {
  if (cachedClient) {
    return cachedClient;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new DriveError(
      "Konfigurasi OAuth Google Drive belum lengkap.",
      "not_configured",
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  cachedClient = google.drive({
    version: "v3",

    auth: oauth2Client,
  });

  return cachedClient;
}

const folderCache = globalThis as unknown as {
  __labkomDriveFolders?: Map<string, string>;
};

const folders = folderCache.__labkomDriveFolders ?? new Map<string, string>();

folderCache.__labkomDriveFolders = folders;

function monthKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",

    year: "numeric",

    month: "2-digit",
  }).format(date);
}

async function ensureFolder(parentId: string, name: string): Promise<string> {
  const cacheKey = `${parentId}/${name}`;

  const cached = folders.get(cacheKey);

  if (cached) {
    return cached;
  }

  const drive = driveClient();

  const escaped = name.replace(/'/g, "\\'");

  const found = await drive.files.list({
    q: `'${parentId}' in parents and name='${escaped}' and mimeType='${FOLDER_MIME}' and trashed=false`,

    fields: "files(id,name)",

    pageSize: 1,
  });

  const existing = found.data.files?.[0]?.id;

  if (existing) {
    folders.set(cacheKey, existing);

    return existing;
  }

  const created = await drive.files.create({
    requestBody: {
      name,

      mimeType: FOLDER_MIME,

      parents: [parentId],
    },

    fields: "id",
  });

  const id = created.data.id;

  if (!id) {
    throw new DriveError("Folder Google Drive gagal dibuat.", "upload_failed");
  }

  folders.set(cacheKey, id);

  return id;
}

async function targetFolder(): Promise<string> {
  const config = driveConfig();

  if (!config) {
    throw new DriveError("Google Drive belum aktif.", "not_configured");
  }

  if (!config.subfolder) {
    return config.folderId;
  }

  return ensureFolder(
    config.folderId,

    `${config.subfolder} ${monthKey()}`,
  );
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

export async function uploadPaymentProof(input: {
  buffer: Buffer | Uint8Array;
  fileName: string;
  mimeType: string;
  orderCode: string;
  clientRef: string;
}): Promise<UploadedProof> {
  const drive = driveClient();

  const config = driveConfig();

  if (!config) {
    throw new DriveError(
      "Konfigurasi Drive tidak ditemukan.",
      "not_configured",
    );
  }

  const parent = await targetFolder();

  const name = `${input.orderCode} - ${safeFileName(input.fileName)}`;

  const body = Buffer.isBuffer(input.buffer)
    ? input.buffer
    : Buffer.from(input.buffer);

  try {
    const created = await drive.files.create({
      requestBody: {
        name,

        parents: [parent],

        description: `Bukti pembayaran LabKom order ${input.orderCode}`,
      },

      media: {
        mimeType: input.mimeType,

        body: Readable.from(body),
      },

      fields: "id,name,size,webViewLink",
    });

    const fileId = created.data.id;

    if (!fileId) {
      throw new DriveError("File ID tidak ditemukan.", "upload_failed");
    }

    if (config.anyoneReader) {
      await drive.permissions.create({
        fileId,

        requestBody: {
          role: "reader",

          type: "anyone",
        },
      });
    }

    return {
      fileId,

      name: created.data.name ?? name,

      size: body.byteLength,

      url:
        created.data.webViewLink ??
        `https://drive.google.com/file/d/${fileId}/view`,
    };
  } catch (error) {
    console.error("google drive upload error", error);

    throw new DriveError("Upload Google Drive gagal.", "upload_failed");
  }
}


export type PaymentProofFile = {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
  name: string;
  size: number | null;
};

export async function getProofLink(fileId: string): Promise<string> {
  try {
    const drive = driveClient();
    const file = await drive.files.get({
      fileId,
      fields: "webViewLink,webContentLink",
    });
    return (
      file.data.webViewLink ??
      file.data.webContentLink ??
      `https://drive.google.com/file/d/${fileId}/view`
    );
  } catch (error) {
    console.error("google drive link error", error);
    throw new DriveError("Gagal mengambil link Google Drive.", "read_failed");
  }
}

export async function readPaymentProof(fileId: string): Promise<PaymentProofFile> {
  try {
    const drive = driveClient();
    const meta = await drive.files.get({
      fileId,
      fields: "name,mimeType,size",
    });
    const media = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );
    const nodeStream = media.data as unknown as Readable;
    return {
      stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
      mimeType: meta.data.mimeType ?? "application/octet-stream",
      name: meta.data.name ?? "payment-proof",
      size: meta.data.size ? Number(meta.data.size) : null,
    };
  } catch (error) {
    console.error("google drive read error", error);
    throw new DriveError("Gagal membaca file Google Drive.", "read_failed");
  }
}

export async function deletePaymentProof(fileId: string): Promise<void> {
  try {
    const drive = driveClient();

    await drive.files.delete({
      fileId,
    });
  } catch (error) {
    console.error("google drive delete error", error);

    throw new DriveError("Gagal menghapus file Google Drive.", "delete_failed");
  }
}
