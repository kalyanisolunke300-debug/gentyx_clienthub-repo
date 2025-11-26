// app/api/documents/list/route.ts
import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: "clientId is required" },
        { status: 400 }
      );
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = blobServiceClient.getContainerClient("clienthub");

    // folder example: client-14/*
    const prefix = `client-${clientId}/`;
    const result: any[] = [];

    for await (const item of containerClient.listBlobsFlat({ prefix })) {
      result.push({
        name: item.name.split("/").pop(),
        path: item.name,
        type: item.properties.contentType || "Unknown",
        size: item.properties.contentLength || 0,
        url: containerClient.getBlockBlobClient(item.name).url,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
