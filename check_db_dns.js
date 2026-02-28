const dns = require('dns');

dns.resolveCname('db.gcsdiilorkuvtxfwncld.supabase.co', (err, addresses) => {
    console.log('CNAME addresses: %j', addresses);
    if (err) console.error(err);
});

dns.resolveAny('db.gcsdiilorkuvtxfwncld.supabase.co', (err, records) => {
    console.log('All records for db: %j', records);
    if (err) console.error(err);
});
