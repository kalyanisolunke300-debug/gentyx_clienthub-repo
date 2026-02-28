const dns = require('dns');

dns.lookup('gcsdiilorkuvtxfwncld.supabase.co', (err, address, family) => {
    console.log('address: %j family: IPv%s', address, family);
    if (err) console.error(err);
});

dns.resolve6('gcsdiilorkuvtxfwncld.supabase.co', (err, addresses) => {
    console.log('IPv6 addresses: %j', addresses);
    if (err) console.error(err);
});

dns.resolveAny('gcsdiilorkuvtxfwncld.supabase.co', (err, records) => {
    console.log('All records: %j', records);
    if (err) console.error(err);
});
