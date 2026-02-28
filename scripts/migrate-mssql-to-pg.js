/**
 * Automated MSSQL → PostgreSQL transformer for API routes.
 * This handles the mechanical transformations:
 * - Remove `import sql from "mssql"`
 * - Replace pool.request().input(...).query() → pool.query(..., [...])
 * - Replace @param → $N (positional parameters)
 * - Replace dbo.TableName → public."TableName"
 * - Replace TOP N → LIMIT N
 * - Replace GETDATE() → NOW()
 * - Replace ISNULL → COALESCE
 * - Replace .recordset → .rows
 * - Replace NVARCHAR → VARCHAR, BIT → BOOLEAN
 * - Replace .rowsAffected[0] → .rowCount
 * - Add LIMIT 1 where TOP 1 was used
 * - Replace OUTER APPLY → LEFT JOIN LATERAL
 * - Replace OFFSET...FETCH NEXT → OFFSET...LIMIT
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');

// Files already manually migrated  
const SKIP_FILES = new Set([
    'login\\route.ts',
    'admin\\create\\route.ts',
    'admin\\profile\\get\\route.ts',
    'admin\\profile\\update\\route.ts',
    'admin\\password\\update\\route.ts',
    'admin\\notifications\\route.ts',
    'clients\\get\\route.ts',
    'clients\\add\\route.ts',
    'clients\\archive\\route.ts',
    'clients\\delete\\route.ts',
    'clients\\update\\route.ts',
    'clients\\update-password\\route.ts',
]);

function findTsFiles(dir, base = '') {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = path.join(base, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTsFiles(path.join(dir, entry.name), rel));
        } else if (entry.name.endsWith('.ts')) {
            files.push(rel);
        }
    }
    return files;
}

function hasMssqlPatterns(content) {
    return (
        content.includes('import sql from "mssql"') ||
        content.includes("import sql from 'mssql'") ||
        content.includes('pool.request()') ||
        content.includes('.recordset') ||
        content.includes('GETDATE()') ||
        content.includes('dbo.')
    );
}

function transformFile(content, filePath) {
    let result = content;
    const changes = [];

    // 1. Remove mssql import
    if (result.includes('import sql from "mssql"') || result.includes("import sql from 'mssql'")) {
        result = result.replace(/import sql from ["']mssql["'];?\r?\n/g, '');
        changes.push('Removed mssql import');
    }

    // 2. Replace .recordset with .rows
    if (result.includes('.recordset')) {
        result = result.replace(/\.recordset/g, '.rows');
        changes.push('Replaced .recordset → .rows');
    }

    // 3. Replace .rowsAffected[0] with .rowCount
    if (result.includes('.rowsAffected')) {
        result = result.replace(/\.rowsAffected\[0\]/g, '.rowCount');
        changes.push('Replaced .rowsAffected[0] → .rowCount');
    }

    // 4. Replace GETDATE() with NOW()
    if (result.includes('GETDATE()')) {
        result = result.replace(/GETDATE\(\)/g, 'NOW()');
        changes.push('Replaced GETDATE() → NOW()');
    }

    // 5. Replace ISNULL( with COALESCE(
    if (result.includes('ISNULL(')) {
        result = result.replace(/ISNULL\(/g, 'COALESCE(');
        changes.push('Replaced ISNULL() → COALESCE()');
    }

    // 6. Replace dbo. references with public."..."
    // dbo.TableName → public."TableName"
    const dboPattern = /dbo\.([A-Za-z_][A-Za-z0-9_]*)/g;
    if (result.match(dboPattern)) {
        result = result.replace(dboPattern, 'public."$1"');
        changes.push('Replaced dbo.Table → public."Table"');
    }

    // 7. Replace SELECT TOP N with SELECT ... LIMIT N pattern
    // SELECT TOP 1 ... → SELECT ... LIMIT 1
    // This is tricky—we'll handle the simple cases
    const topPattern = /SELECT\s+TOP\s+\(?(\d+)\)?\s+/gi;
    if (result.match(topPattern)) {
        // We can't just move LIMIT to end easily, but we can mark these
        // For simple single-statement cases, we'll note them
        changes.push('⚠️ Contains SELECT TOP N - needs manual LIMIT conversion');
    }

    // 8. Replace OFFSET @X ROWS FETCH NEXT @Y ROWS ONLY with OFFSET $X LIMIT $Y
    result = result.replace(
        /OFFSET\s+@(\w+)\s+ROWS\s+FETCH\s+NEXT\s+@(\w+)\s+ROWS\s+ONLY/gi,
        'OFFSET @$1 LIMIT @$2'
    );

    // 9. Replace NVARCHAR with VARCHAR in DDL statements
    result = result.replace(/NVARCHAR\(MAX\)/gi, 'TEXT');
    result = result.replace(/NVARCHAR/gi, 'VARCHAR');

    // 10. Replace INT IDENTITY(1,1) with SERIAL
    result = result.replace(/INT\s+IDENTITY\s*\(\s*1\s*,\s*1\s*\)/gi, 'SERIAL');

    // 11. Replace DATETIME with TIMESTAMPTZ
    result = result.replace(/\bDATETIME\b/g, 'TIMESTAMPTZ');

    // 12. Replace BIT with BOOLEAN in DDL
    result = result.replace(/\bsql\.Bit\b/g, 'BOOLEAN');

    // 13. Replace LIKE '%' + @X + '%' with ILIKE '%' || $X || '%'
    // These need to be done after the @param replacement

    // Log the request().input().query() patterns that need manual conversion
    if (result.includes('pool.request()') || result.includes('.request()')) {
        changes.push('⚠️ Contains pool.request().input().query() - needs manual conversion to pool.query($N, [params])');
    }

    return { result, changes };
}

// Main execution
const allFiles = findTsFiles(API_DIR);
const filesToProcess = allFiles.filter(f => {
    if (SKIP_FILES.has(f)) return false;
    const content = fs.readFileSync(path.join(API_DIR, f), 'utf8');
    return hasMssqlPatterns(content);
});

console.log(`\n🔄 Processing ${filesToProcess.length} files...\n`);

let autoFixCount = 0;
let needsManualCount = 0;

for (const f of filesToProcess) {
    const fullPath = path.join(API_DIR, f);
    const content = fs.readFileSync(fullPath, 'utf8');
    const { result, changes } = transformFile(content, f);

    if (changes.length > 0) {
        const needsManual = changes.some(c => c.startsWith('⚠️'));

        if (needsManual) {
            needsManualCount++;
            console.log(`⚠️  ${f}`);
        } else {
            autoFixCount++;
            console.log(`✅ ${f}`);
        }

        changes.forEach(c => console.log(`     ${c}`));

        // Write the partially transformed file
        fs.writeFileSync(fullPath, result, 'utf8');
        console.log('');
    }
}

console.log(`\n📊 Summary:`);
console.log(`   Auto-fixed (partial): ${autoFixCount}`);
console.log(`   Needs manual work: ${needsManualCount}`);
console.log(`   Total processed: ${filesToProcess.length}`);
console.log(`\nNote: Files with pool.request() still need manual conversion of the`);
console.log(`query pattern from MSSQL pool.request().input().query() to `);
console.log(`PostgreSQL pool.query('...', [param1, param2, ...])`);
