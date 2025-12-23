// /app/api/documents/upload/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { logAudit, AuditActions } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const clientId = formData.get("clientId") as string;
    const folderName = (formData.get("folderName") as string)?.trim() || null;
    const file = formData.get("file") as File;

    if (!clientId || !file) {
      return NextResponse.json(
        { success: false, error: "Client and file are required" },
        { status: 400 }
      );
    }

    // ✅ SAFETY: Never allow manual .keep upload
    if (file.name === ".keep") {
      return NextResponse.json(
        { success: false, error: "Invalid file name" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;

    // ✅ ✅ FINAL UPLOAD PATH LOGIC (ROOT + FOLDER SAFE)
    const blobPath = folderName
      ? `client-${clientId}/${folderName}/${fileName}`
      : `client-${clientId}/${fileName}`;

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME!;

    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    // ✅ PREVENT OVERWRITE
    const exists = await blockBlobClient.exists();
    if (exists) {
      return NextResponse.json(
        { success: false, error: "File already exists" },
        { status: 409 }
      );
    }

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    // Audit log
    logAudit({
      clientId: Number(clientId),
      action: AuditActions.DOCUMENT_UPLOADED,
      actorRole: "ADMIN",
      details: fileName,
    });

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      path: blobPath,
      url: blockBlobClient.url,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
