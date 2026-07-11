/* Alfa Informática — Cliente Supabase compartilhado por toda a loja e pelo painel admin. */
window.SUPABASE_URL = 'https://ybkgevyahpkkxhiexejy.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_X3qbw8bNCRrT480eR2CYaw_vd28oY3C';

window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
