export const ROLE_LABELS = {
  admin: 'Amministratore',
  produzione: 'Produzione',
  ufficio: 'Ufficio',
};

export const DEPARTMENT_LABELS = {
  produzione: 'Produzione',
  ufficio: 'Ufficio',
};

export function normalizeDepartment(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'office' || raw === 'acquisti' || raw === 'ufficio acquisti') return 'ufficio';
  if (raw === 'production') return 'produzione';
  return raw || null;
}

export function roleNeedsDepartment(role) {
  return role === 'produzione' || role === 'ufficio';
}

export function getRoleHomePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'ufficio') return '/ufficio';
  if (role === 'produzione') return '/produzione';
  return '/';
}

export function canAccessDepartment(role, userDepartment, targetDepartment) {
  if (role === 'admin') return true;
  const normalizedUserDepartment = normalizeDepartment(userDepartment);
  const normalizedTargetDepartment = normalizeDepartment(targetDepartment);
  return !!normalizedUserDepartment && normalizedUserDepartment === normalizedTargetDepartment;
}
