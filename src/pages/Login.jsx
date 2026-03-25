import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await signIn(email, password);
      nav("/", { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Errore login");
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: "40px auto" }}>
        <div className="cardHeader">
          <div>
            <h1 className="h1">Timesheet</h1>
            <p className="sub">Accedi come Admin o Produzione</p>
          </div>
          <span className="badge">Idealtech</span>
        </div>

        <hr className="sep" />

        <form onSubmit={onSubmit} className="grid">
          <div className="formGroup">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@idealtech.it" />
          </div>

          <div className="formGroup">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
          </div>

          {err && <div className="toast err">{err}</div>}

          <button className="btn btnPrimary">Accedi</button>

          <p className="sub" style={{ margin: 0 }}>
          </p>
        </form>
      </div>
    </div>
  );
}