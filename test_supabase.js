const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.from('Users').select('count', { count: 'exact', head: true });
    if (error) {
        console.error("❌ Supabase SDK Error:", error.message);
    } else {
        console.log("✔️ Supabase SDK Success! Table 'Users' accessible.");
    }
}

testSupabase();
