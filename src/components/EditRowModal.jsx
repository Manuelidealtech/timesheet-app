import React, { useEffect, useState } from "react";

export default function EditRowModal({ open, title, fields, initial, onClose, onSave }) {
  const [values, setValues] = useState({});
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setValues(initial || {});
    setErr("");
  }, [open, initial]);

  if (!open) return null;

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave() {
    setErr("");
    // validazioni minime: required
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        setErr(`Compila: ${f.label}`);
        return;
      }
    }
    try {
      await onSave(values);
    } catch (e2) {
      setErr(e2?.message || "Errore salvataggio");
    }
  }

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cardHeader">
          <div>
            <div className="sub">{title}</div>
            <div style={{ fontWeight: 850, marginTop: 4 }}>Modifica</div>
          </div>
          <button className="btn" onClick={onClose}>Chiudi</button>
        </div>

        <hr className="sep" />

        <div className="grid">
          {fields.map((f) => (
            <div className="formGroup" key={f.key}>
              <label>{f.label}</label>

              {f.type === "textarea" ? (
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              ) : (
                <input
                  type={f.type || "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder || ""}
                />
              )}
            </div>
          ))}

          {err && <div className="toast err">{err}</div>}

          <div className="row">
            <div className="spacer" />
            <button className="btn btnPrimary" onClick={handleSave}>Salva</button>
          </div>
        </div>
      </div>
    </div>
  );
}