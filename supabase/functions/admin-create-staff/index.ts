// Alfa Informática — Edge Function: cria uma conta de funcionário já com o
// cargo definido pelo Administrador. Roda no servidor porque só aqui é seguro
// usar a service_role key (nunca deve ir para o navegador).
//
// Deploy (rodar localmente, uma vez, com a Supabase CLI já instalada e logada):
//   supabase link --project-ref ybkgevyahpkkxhiexejy
//   supabase functions deploy admin-create-staff
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<sua service_role key, em Project Settings > API>
//
// A service_role key NUNCA deve ser colada em nenhum arquivo do projeto — só no
// comando `supabase secrets set`, que a guarda de forma segura no servidor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ROLES = ['administrador', 'gerente', 'funcionario', 'financeiro', 'suporte', 'editor'];

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin.from('profiles').select('role,is_blocked').eq('id', caller.id).single();
    if (!callerProfile || callerProfile.is_blocked) {
      return new Response(JSON.stringify({ error: 'Conta sem permissão.' }), { status: 403, headers: corsHeaders });
    }
    const { data: canManage } = await admin
      .from('role_permissions').select('allowed')
      .eq('role', callerProfile.role).eq('permission_key', 'equipe.gerenciar').eq('allowed', true).maybeSingle();
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Você não tem permissão para gerenciar a equipe.' }), { status: 403, headers: corsHeaders });
    }

    const { full_name, email, password, role } = await req.json();
    if (!full_name || !email || !password || password.length < 6 || !ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos.' }), { status: 400, headers: corsHeaders });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }

    // O trigger handle_new_user já cria a profile com o role vindo do metadata,
    // mas garantimos aqui caso o trigger não tenha rodado a tempo.
    await admin.from('profiles').update({ full_name, role, email }).eq('id', created.user.id);

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
