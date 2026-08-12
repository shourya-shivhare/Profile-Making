import supabase from './src/db/supabaseClient.js';

async function testRoles() {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('is_deleted', false);
    
    console.log("Roles:", data);
    console.log("Error:", error);
  } catch (err) {
    console.error("Exception:", err);
  }
}

testRoles();
