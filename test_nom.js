const https = require('https');
function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'NISConnect/1.0' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
}
async function run() {
  const duke = await get("https://nominatim.openstreetmap.org/search?q=Duke+University&format=json&limit=1");
  console.log("Duke:", duke[0]?.lat, duke[0]?.lon, duke[0]?.display_name);
  const mit = await get("https://nominatim.openstreetmap.org/search?q=Massachusetts+Institute+of+Technology&format=json&limit=1");
  console.log("MIT:", mit[0]?.lat, mit[0]?.lon, mit[0]?.display_name);
}
run();
