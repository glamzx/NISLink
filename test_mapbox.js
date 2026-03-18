const fs = require('fs');

async function testGeocode(query) {
    // We need MAPBOX_TOKEN
    const config = fs.readFileSync('js/mapbox-config.js', 'utf8');
    const match = config.match(/const MAPBOX_ACCESS_TOKEN\s*=\s*['"]([^'"]+)['"]/);
    if (!match) return console.error('No token found');
    const token = match[1];

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=3`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`\nQuery: "${query}"`);
    if(data.features) {
        data.features.forEach(f => {
            console.log(`- ${f.place_name} (${f.place_type}) => [${f.center}]`);
        });
    } else {
        console.log('No results or error', data);
    }
}

async function run() {
    await testGeocode('HKU');
    await testGeocode('HKU university');
    await testGeocode('Hong Kong University');
    await testGeocode('UCL');
    await testGeocode('UCL university');
}
run();
