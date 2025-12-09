// app/api/documents/delete/route.ts
import { NextResponse } from "next/server";
import { deleteBlob } from "@/lib/azure";

export async function POST(req: Request) {
  try {
    const { clientId, fileName, fileType } = await req.json();

    if (!clientId || !fileName || !fileType) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Correct blob path based on your Azure folder structure
    const blobPath = `client-${clientId}/${fileType}/${fileName}`;

    // Delete from Azure Blob Storage
    await deleteBlob(blobPath);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete Error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
