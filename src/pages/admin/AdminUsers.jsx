import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DEPARTMENT_LABELS, ROLE_LABELS, roleNeedsDepartment } from '../../lib/access';

const initialCreate = {
  email: '',
  password: '',
  display_name: '',
  role: 'ufficio',
  department: 'ufficio',
  employee_id: '',
};

export default function AdminUsers() {
  const [profiles, setProfiles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState(initialCreate);
  const [editingId, setEditingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const departmentOptions = useMemo(() => {
    const set = new Set(employees.map((item) => item.department).filter(Boolean));

    if (form.role === 'produzione') set.add('produzione');
    if (form.role === 'ufficio') set.add('ufficio');

    return Array.from(set);
  }, [employees, form.role]);

  const currentEmployeeOptions = useMemo(() => {
    if (!form.department) return employees;
    return employees.filter((item) => item.department === form.department);
  }, [employees, form.department]);

  async function loadData() {
    setLoading(true);
    setErr('');

    try {
      const [profilesRes, employeesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, email, display_name, role, department, employee_id, is_active, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('employees')
          .select('id, full_name, department, is_active')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (employeesRes.error) throw employeesRes.error;

      setProfiles(profilesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (loadError) {
      console.error(loadError);
      setErr(loadError?.message || 'Errore caricamento utenti');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toast(message) {
    setOk(message);
    setTimeout(() => setOk(''), 2200);
  }

  function resetForm() {
    setForm(initialCreate);
    setEditingId(null);
    setErr('');
  }

  function normalizePayloadFromForm(currentForm, extra = {}) {
    const needsDepartment = roleNeedsDepartment(currentForm.role);
    return {
      email: currentForm.email.trim(),
      display_name: currentForm.display_name.trim(),
      role: currentForm.role,
      department: needsDepartment ? currentForm.department || null : null,
      employee_id: needsDepartment && currentForm.employee_id ? Number(currentForm.employee_id) : null,
      ...extra,
    };
  }

  async function handleCreateUser() {
    setErr('');

    if (!form.email.trim()) return setErr("Inserisci l'email.");
    if (!form.password.trim()) return setErr('Inserisci una password iniziale.');
    if (!form.display_name.trim()) return setErr('Inserisci il nome visualizzato.');
    if (roleNeedsDepartment(form.role) && !form.department) return setErr('Seleziona un reparto.');
    if (roleNeedsDepartment(form.role) && !form.employee_id) {
      return setErr('Seleziona il dipendente collegato.');
    }

    try {
      setSaving(true);

      const payload = {
        action: 'create',
        ...normalizePayloadFromForm(form),
        password: form.password,
      };

      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast('Utente creato ✅');
      resetForm();
      await loadData();
    } catch (createError) {
      console.error(createError);
      setErr(createError?.message || 'Errore creazione utente');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setErr('');
    if (!editingId) return;
    if (!form.email.trim()) return setErr("Inserisci l'email.");
    if (!form.display_name.trim()) return setErr('Inserisci il nome visualizzato.');
    if (roleNeedsDepartment(form.role) && !form.department) return setErr('Seleziona un reparto.');
    if (roleNeedsDepartment(form.role) && !form.employee_id) {
      return setErr('Seleziona il dipendente collegato.');
    }

    try {
      setSaving(true);

      const existing = profiles.find((item) => item.user_id === editingId);

      const payload = {
        action: 'update',
        user_id: editingId,
        ...normalizePayloadFromForm(form),
        is_active: existing?.is_active !== false,
        password: form.password?.trim() || null,
      };
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast('Profilo aggiornato ✅');
      resetForm();
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setErr(saveError?.message || 'Errore aggiornamento profilo');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(profile) {
    setErr('');

    try {
      const payload = {
        action: 'update',
        user_id: profile.user_id,
        email: profile.email || '',
        display_name: profile.display_name || '',
        role: profile.role || 'ufficio',
        department: roleNeedsDepartment(profile.role) ? profile.department || null : null,
        employee_id: roleNeedsDepartment(profile.role) && profile.employee_id ? Number(profile.employee_id) : null,
        is_active: profile.is_active === false,
      };

      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast(profile.is_active === false ? 'Utente riattivato ✅' : 'Utente disattivato ✅');
      await loadData();
    } catch (toggleError) {
      console.error(toggleError);
      setErr(toggleError?.message || 'Errore aggiornamento stato');
    }
  }

  async function removeUser(profile) {
    if (!window.confirm(`Eliminare definitivamente ${profile.display_name || profile.email}?`)) return;
    setErr('');

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: profile.user_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast('Utente eliminato ✅');
      await loadData();
    } catch (removeError) {
      console.error(removeError);
      setErr(removeError?.message || 'Errore eliminazione utente');
    }
  }

  function startEdit(profile) {
    setEditingId(profile.user_id);
    setErr('');
    setForm({
      email: profile.email || '',
      password: '',
      display_name: profile.display_name || '',
      role: profile.role || 'ufficio',
      department: profile.department || (profile.role === 'produzione' ? 'produzione' : 'ufficio'),
      employee_id: profile.employee_id ? String(profile.employee_id) : '',
    });
  }

  function handleRoleChange(nextRole) {
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      department: roleNeedsDepartment(nextRole)
        ? prev.department || (nextRole === 'produzione' ? 'produzione' : 'ufficio')
        : '',
      employee_id: '',
    }));
  }

  function handleDepartmentChange(nextDepartment) {
    setForm((prev) => ({
      ...prev,
      department: nextDepartment,
      employee_id: '',
    }));
  }

  const title = editingId ? 'Modifica utente' : 'Nuovo utente';

  return (
    <div>
      <div className="cardHeader" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="h1">Admin — Utenti</h1>
          <p className="sub">Crea, modifica, disattiva o elimina gli account che accedono all’app.</p>
        </div>
        <span className="badge">Utenti</span>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="sub">Gestione accessi</div>
            <div style={{ fontWeight: 750, marginTop: 4 }}>{title}</div>
          </div>
        </div>

        <hr className="sep" />

        {err && <div className="toast err">{err}</div>}
        {ok && <div className="toast ok">{ok}</div>}

        <div className="grid2">
          <div className="formGroup">
            <label>Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="nome@idealtech.it"
              disabled={!!editingId}
            />
          </div>

          <div className="formGroup">
            <label>{editingId ? 'Nuova password' : 'Password iniziale'}</label>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder={
                  editingId
                    ? 'Lascia vuoto per non cambiarla'
                    : 'Password iniziale'
                }
                disabled={saving}
              />

              <button
                type="button"
                className="btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Nascondi' : 'Mostra'}
              </button>
            </div>

            {editingId && (
              <div className="sub" style={{ marginTop: 6 }}>
                La password attuale non è visualizzabile. Qui puoi impostarne una nuova.
              </div>
            )}
          </div>

          <div className="formGroup">
            <label>Nome visualizzato</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
              placeholder="Es: Lucia Bianchi"
            />
          </div>

          <div className="formGroup">
            <label>Ruolo</label>
            <select value={form.role} onChange={(e) => handleRoleChange(e.target.value)}>
              <option value="ufficio">Ufficio</option>
              <option value="produzione">Produzione</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {roleNeedsDepartment(form.role) && (
            <>
              <div className="formGroup">
                <label>Reparto</label>
                <select value={form.department} onChange={(e) => handleDepartmentChange(e.target.value)}>
                  <option value="">Seleziona reparto</option>
                  {departmentOptions.map((dep) => (
                    <option key={dep} value={dep}>
                      {DEPARTMENT_LABELS[dep] || dep}
                    </option>
                  ))}
                </select>
              </div>

              <div className="formGroup">
                <label>Dipendente collegato</label>
                <select
                  value={form.employee_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                >
                  <option value="">Nessun collegamento</option>
                  {currentEmployeeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          {editingId ? (
            <>
              <button className="btn btnPrimary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva modifiche'}
              </button>
              <button className="btn" onClick={resetForm}>
                Annulla
              </button>
            </>
          ) : (
            <button className="btn btnPrimary" onClick={handleCreateUser} disabled={saving}>
              {saving ? 'Creazione...' : 'Crea utente'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="cardHeader">
          <div>
            <div className="sub">Utenti registrati</div>
            <div style={{ fontWeight: 750, marginTop: 4 }}>
              {loading ? 'Caricamento...' : `${profiles.length} profili`}
            </div>
          </div>
        </div>

        <hr className="sep" />

        <div className="tableWrap">
          <table style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Reparto</th>
                <th>Stato</th>
                <th className="actionsCell">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.user_id}>
                  <td>{profile.display_name || '—'}</td>
                  <td>{profile.email || '—'}</td>
                  <td>{ROLE_LABELS[profile.role] || profile.role || '—'}</td>
                  <td>{DEPARTMENT_LABELS[profile.department] || profile.department || '—'}</td>
                  <td>{profile.is_active === false ? 'Disattivo' : 'Attivo'}</td>
                  <td className="actionsCell">
                    <button className="btn iconBtn" onClick={() => startEdit(profile)}>
                      Modifica
                    </button>
                    <button className="btn" onClick={() => toggleActive(profile)}>
                      {profile.is_active === false ? 'Riattiva' : 'Disattiva'}
                    </button>
                    <button className="btn btnDanger" onClick={() => removeUser(profile)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}

              {!profiles.length && !loading && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', opacity: 0.7, padding: 18 }}>
                    Nessun utente trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}