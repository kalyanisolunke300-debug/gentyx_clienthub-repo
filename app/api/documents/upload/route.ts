// app/api/documents/upload/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const clientId = formData.get("clientId") as string;
    const fileType = formData.get("fileType") as string;
    const file = formData.get("file") as File;

    if (!clientId || !fileType || !file) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;

    // Build blob path
    const blobPath = `client-${clientId}/${fileType}/${fileName}`;

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient("clienthub");

    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    // Upload file
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
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
