// Server address (Supabase project "ricotta-staff", org "Cafe Ricotta", Canada Central).
// The publishable key is public by design; access is controlled by the database rules in supabase/migrations.
window.RICOTTA_CONFIG = {
  url: 'https://pyxunhxrkeefgaduhibv.supabase.co',
  anonKey: 'sb_publishable_QGEIdtWUoj-QJo_sxEy7oQ_OgI1GuNn',
  // Public half of the web-push key pair (the private half lives only in GitHub Actions secrets).
  vapidPublicKey: 'BPDi7zwYFdkzYYbdLj5OI-e9Aqzc6bntcCtDuBZpyu7rvB-JCOdeuGxvcJVIdxfZyL8kE3s0wIR3DyGQX4IC4cs',
};
