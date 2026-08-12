import fs from 'fs';

async function checkSupabase() {
  let log = "Checking Supabase connection...\n";
  try {
    const res = await fetch("https://nsyshhycairpwzbendgb.supabase.co/rest/v1/", {
      method: 'GET'
    });
    log += `Status: ${res.status}\n`;
    const text = await res.text();
    log += `Response length: ${text.length}\n`;
  } catch(e) {
    log += `Fetch failed with: ${e.message}\n`;
    if(e.cause) {
      log += `Cause message: ${e.cause.message}\n`;
      log += `Cause code: ${e.cause.code}\n`;
    }
  }
  fs.writeFileSync('test-out.txt', log);
}
checkSupabase();
