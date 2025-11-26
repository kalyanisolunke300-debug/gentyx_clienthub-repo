// app/api/documents/upload/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { getDbPool } from "@/lib/db";
import sql from "mssql";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  console.log("UPLOAD API HIT");

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

    // ---- Convert file ----
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;

    // ---- Blob Path ----
    const blobPath = `client-${clientId}/${fileType}/${fileName}`;

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn!);
    const containerClient = blobServiceClient.getContainerClient("clienthub");

    await containerClient.createIfNotExists();

    // Upload to Blob
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    // Generate public URL
    const blobUrl = blockBlobClient.url;

    // ---- Insert Metadata in SQL ----
    const pool = await getDbPool();
    await pool
      .request()
      .input("client_id", sql.Int, clientId)
      .input("name", sql.VarChar, fileName)
      .input("type", sql.VarChar, fileType)
      .input("status", sql.VarChar, "Uploaded")
      .input("notes", sql.VarChar, null)
      .input("url", sql.VarChar, blobUrl)
      .query(`
        INSERT INTO dbo.client_documents
        (client_id, name, type, status, notes, url)
        VALUES (@client_id, @name, @type, @status, @notes, @url)
      `);

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      path: blobPath,
      url: blobUrl,
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
