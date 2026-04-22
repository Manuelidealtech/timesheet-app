import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Metodo non consentito' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: 'Secrets mancanti: SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header mancante' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token non valido' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: authData, error: authError } = await supabaseUser.auth.getUser(token);

    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || 'Utente non autenticato' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const callerUserId = authData.user.id;

    const { data: callerProfile, error: callerProfileError } = await supabaseUser
      .from('profiles')
      .select('user_id, role, is_active')
      .eq('user_id', callerUserId)
      .maybeSingle();

    if (callerProfileError) {
      return new Response(
        JSON.stringify({ error: callerProfileError.message }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (!callerProfile || callerProfile.is_active === false || callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Accesso negato: solo gli amministratori possono gestire utenti' }),
        { status: 403, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action = body?.action;

    if (action === 'create') {
      const { email, password, display_name, role, department, employee_id } = body;

      if (!email || !password || !display_name || !role) {
        return new Response(
          JSON.stringify({ error: 'Parametri mancanti per la creazione utente' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const normalizedDepartment = department || null;
      const normalizedEmployeeId =
        employee_id === '' || employee_id === undefined || employee_id === null
          ? null
          : Number(employee_id);

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name,
          role,
          department: normalizedDepartment,
          employee_id: normalizedEmployeeId,
        },
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!data.user) {
        return new Response(
          JSON.stringify({ error: 'Utente non creato' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            user_id: data.user.id,
            email,
            display_name,
            role,
            department: normalizedDepartment,
            employee_id: normalizedEmployeeId,
            is_active: true,
          },
          { onConflict: 'user_id' }
        );

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, user_id: data.user.id }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (action === 'delete') {
      const userId = body?.user_id;
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'user_id mancante' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) {
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (action === 'update') {
      const { user_id, email, display_name, role, department, employee_id, is_active } = body;

      if (!user_id || !email || !display_name || !role) {
        return new Response(
          JSON.stringify({ error: 'Parametri mancanti per la modifica utente' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const normalizedDepartment = department || null;
      const normalizedEmployeeId =
        employee_id === '' || employee_id === undefined || employee_id === null
          ? null
          : Number(employee_id);

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          email,
          display_name,
          role,
          department: normalizedDepartment,
          employee_id: normalizedEmployeeId,
          is_active: is_active !== false,
        })
        .eq('user_id', user_id);

      if (profileError) {
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        email,
        user_metadata: {
          display_name,
          role,
          department: normalizedDepartment,
          employee_id: normalizedEmployeeId,
        },
      });

      if (authUpdateError) {
        return new Response(
          JSON.stringify({ error: authUpdateError.message }),
          { status: 400, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Azione non supportata' }),
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});