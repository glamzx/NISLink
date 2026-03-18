async function test(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NISConnect/1.0' } });
    const data = await res.json();
    console.log(`\nQuery: "${query}"`);
    if(data.length > 0) {
        console.log(`- ${data[0].display_name} => [${data[0].lon}, ${data[0].lat}]`);
    } else {
        console.log('No results');
    }
}
async function run() {
    await test('MIT');
    await test('MIT university');
    await test('Duke university');
    await test('HKU university');
}
run();
