"use client";

import { useState } from "react";
import styles from "./manage.module.css";

export function SignInCodeButton() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function makeCode() {
    setBusy(true);
    try {
      const res = await fetch("/api/licence/sign-in-code", { method: "POST" });
      const body = await res.json();
      if (res.ok) setCode(body.code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={() => void makeCode()}>
        {busy ? "Making code…" : "Make a sign-in code"}
      </button>
      {code ? (
        <p className={styles.codeBox}>
          Paste into the app: <code>{code}</code>
        </p>
      ) : null}
    </div>
  );
}
