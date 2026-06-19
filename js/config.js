const SUPABASE_URL = "https://ticwuyuzzazofnofdrik.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpY3d1eXV6emF6b2Zub2ZkcmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NzYyNTAsImV4cCI6MjA5NzQ1MjI1MH0.cDpGilPYgLdRiPaEF8FK4YT9mExb2PZzTG1u1TOOCPM";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;
