
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientRootFolder } from "@/lib/storage-utils";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "client_hub";

export async function POST(req: Request) {
  try {
    const { clientId, folderPath } = await req.json();

    if (!clientId || !folderPath) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 }
      );
    }

    const rootFolder = await getClientRootFolder(clientId);
    const prefix = `${rootFolder}/${folderPath}`;

    // List all objects under the folder prefix
    const { data, error: listError } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });

    if (listError) throw new Error(listError.message);

    // Build the full paths of all files to delete
    const filePaths = (data ?? [] as Array<{ id: string | null; name: string }>)
      .filter((item: { id: string | null; name: string }) => item.id !== null)
      .map((item: { name: string }) => `${prefix}/${item.name}`);

    if (filePaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove(filePaths);

      if (removeError) throw new Error(removeError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE FOLDER ERROR:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
