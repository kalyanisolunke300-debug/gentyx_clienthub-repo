// app/api/email-templates/delete/route.ts
// import { NextResponse } from "next/server";
// import { getDbPool } from "@/lib/db";

// export async function DELETE(req: Request) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const id = searchParams.get("id");

//     if (!id) {
//       return NextResponse.json(
//         { success: false, error: "Missing id parameter" },
//         { status: 400 }
//       );
//     }

//     const pool = await getDbPool();

//     await pool.request()
//       .input("id", id)
//       .query(`
//         DELETE FROM email_templates
//         WHERE id = @id
//       `);

//     return NextResponse.json({ success: true });

//   } catch (error: any) {
//     return NextResponse.json(
//       { success: false, error: error.message },
//       { status: 500 }
//     );
//   }
// }


// app/api/email-templates/delete/route.ts
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing template id" },
        { status: 400 }
      );
    }

    const pool = await getDbPool();

    const result = await pool
      .request()
      .input("template_id", Number(id))
      .query(`
        DELETE FROM email_templates
        WHERE template_id = @template_id
      `);

    return NextResponse.json({
      success: true,
      rowsAffected: result.rowsAffected[0],
    });

  } catch (error: any) {
    console.error("Delete email template error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
