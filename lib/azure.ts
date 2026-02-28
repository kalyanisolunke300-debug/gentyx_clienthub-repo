// lib/azure.ts
// Migrated from Azure Blob Storage → Supabase Storage.
// Exposes uploadToSupabase() and deleteFromSupabase() as drop-in replacements.

import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

/**
 * Upload a file buffer to Supabase Storage.
 * @param buffer   File content as Buffer
 * @param blobPath Full path in the bucket, e.g. "John-42/IMG/photo.png"
 * @param mimeType MIME type of the file
 * @returns        Public/signed URL of the uploaded object
 */
export async function uploadToSupabase(
  buffer: Buffer,
  blobPath: string,
  mimeType: string
): Promise<{ path: string; url: string }> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(blobPath, buffer, {
      contentType: mimeType,
      upsert: true, // overwrite if exists (same as Azure default behaviour)
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  // Generate a long-lived signed URL (1 year)
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(blobPath, 60 * 60 * 24 * 365);

  if (signedError || !signedData)
    throw new Error(`Supabase signed URL failed: ${signedError?.message}`);

  return { path: blobPath, url: signedData.signedUrl };
}

/**
 * Delete a file from Supabase Storage.
 * @param blobPath Full path in the bucket, e.g. "John-42/IMG/photo.png"
 */
export async function deleteFromSupabase(blobPath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([blobPath]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

// ─── Legacy Azure exports are commented out below ────────────────────────────
// These were removed as part of the Azure → Supabase migration.

// import { BlobServiceClient } from "@azure/storage-blob";
// const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
// const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;
// export const blobService = BlobServiceClient.fromConnectionString(connectionString);
// export const containerClient = blobService.getContainerClient(containerName);
// export async function uploadToAzure(...) { ... }
// export async function deleteBlob(...) { ... }
