// app/api/documents/upload/route.ts

import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  console.log("UPLOAD API HIT");

  try {
    const formData = await req.formData();
    console.log("FORMDATA RECEIVED:", formData);

    const clientId = formData.get("clientId") as string;
    const fileType = formData.get("fileType") as string;
    const file = formData.get("file") as File;

    console.log("clientId:", clientId);
    console.log("fileType:", fileType);
    console.log("file:", file?.name);

    if (!clientId || !fileType || !file) {
      console.log("Missing fields");
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    console.log("BUFFER SIZE:", fileBuffer.length);

    const fileName = file.name;
    const blobPath = `client-${clientId}/${fileType}/${fileName}`;

    console.log("Blob Path:", blobPath);

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    console.log("CONNECTION STRING EXISTS:", !!conn);

    const blobServiceClient = BlobServiceClient.fromConnectionString(conn!);
    const containerClient = blobServiceClient.getContainerClient("clienthub");

    console.log("Container exists:", await containerClient.exists());

    await containerClient.createIfNotExists();
    console.log("Container created/confirmed");

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    console.log("Uploading to blob...");

    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    console.log("UPLOAD SUCCESS");

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      path: blobPath,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
