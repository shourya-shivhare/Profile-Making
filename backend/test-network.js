async function checkSupabase() {
  console.log("Checking Supabase connection...");
  try {
    const res = await fetch("https://nsyshhycairpwzbendgb.supabase.co/rest/v1/", {
      method: 'GET'
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response length:", text.length);
  } catch(e) {
    console.error("Fetch failed with:", e.message);
    if(e.cause) console.error("Cause:", e.cause);
  }
}
checkSupabase();
