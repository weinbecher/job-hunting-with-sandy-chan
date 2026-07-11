// Supabase configuration — reference template.
//
// Copy the values below into `config.js` (which IS committed, because these two
// values are safe to make public). The `anonKey` is a public "anon" key: it only
// grants the access allowed by the database Row-Level-Security policies in
// supabase/schema.sql, and every table requires a logged-in user. Your real secrets
// (the service_role key, database password) must NEVER go in here.
//
// Where to find these: Supabase dashboard -> Project Settings -> API.
//   - "Project URL"        -> url
//   - "Project API keys" -> "anon" "public" -> anonKey

window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-ANON-PUBLIC-KEY"
};
