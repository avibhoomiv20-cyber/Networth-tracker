"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, KeyRound, LoaderCircle, LockKeyhole, ScanFace, ShieldCheck } from "lucide-react";
import {
  DEVICE_LOCK_CHANGED_EVENT,
  autoLockOptions,
  clearDeviceLockConfig,
  createDeviceLockConfig,
  isDeviceVerificationAvailable,
  isSixDigitPasscode,
  readDeviceLockConfig,
  registerDeviceVerification,
  requestDeviceLock,
  saveDeviceLockConfig,
  setDeviceVerificationInProgress,
  verifyDevicePasscode,
  type DeviceLockConfig,
} from "@/lib/security/deviceLock";

type Operation = "enable" | "change" | "disable" | "biometric" | "remove-biometric" | null;

export function DeviceLockSettings() {
  const [config, setConfig] = useState<DeviceLockConfig | null>(null);
  const [deviceAvailable, setDeviceAvailable] = useState(false);
  const [operation, setOperation] = useState<Operation>(null);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const reload = () => setConfig(readDeviceLockConfig());
    reload();
    void isDeviceVerificationAvailable().then(setDeviceAvailable);
    window.addEventListener(DEVICE_LOCK_CHANGED_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(DEVICE_LOCK_CHANGED_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const resetForm = (nextMessage = "") => {
    setOperation(null);
    setCurrentPasscode("");
    setNewPasscode("");
    setConfirmPasscode("");
    setError("");
    setMessage(nextMessage);
  };

  const start = (nextOperation: Operation) => {
    resetForm();
    setOperation(nextOperation);
  };

  const verifyCurrent = async () => {
    if (!isSixDigitPasscode(currentPasscode)) {
      setError("Enter your current six-digit passcode.");
      return false;
    }
    const result = await verifyDevicePasscode(currentPasscode);
    if (!result.ok) {
      setError(
        result.lockedForMs > 0
          ? `Too many attempts. Try again in ${Math.ceil(result.lockedForMs / 1000)} seconds.`
          : "The current passcode is not correct.",
      );
      return false;
    }
    return true;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!operation || busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (operation !== "enable" && !(await verifyCurrent())) return;

      if (operation === "enable" || operation === "change") {
        if (!isSixDigitPasscode(newPasscode)) {
          setError("Choose exactly six digits.");
          return;
        }
        if (newPasscode !== confirmPasscode) {
          setError("The new passcodes do not match.");
          return;
        }
        saveDeviceLockConfig(await createDeviceLockConfig(newPasscode, config));
        resetForm(operation === "enable" ? "App lock is now on." : "Passcode updated.");
        return;
      }

      if (operation === "disable") {
        clearDeviceLockConfig();
        resetForm("App lock is off on this device.");
        return;
      }

      if (operation === "biometric" && config) {
        setDeviceVerificationInProgress(true);
        let credentialId: string;
        try {
          credentialId = await registerDeviceVerification();
        } finally {
          setDeviceVerificationInProgress(false);
        }
        saveDeviceLockConfig({ ...config, biometricCredentialId: credentialId });
        resetForm("Face ID or Touch ID unlock is ready.");
        return;
      }

      if (operation === "remove-biometric" && config) {
        const nextConfig = { ...config };
        delete nextConfig.biometricCredentialId;
        saveDeviceLockConfig(nextConfig);
        resetForm("Device verification removed.");
      }
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "This security setting could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateTimeout = (autoLockMs: number) => {
    if (!config) return;
    saveDeviceLockConfig({ ...config, autoLockMs });
    setMessage("Auto-lock timing updated.");
  };

  return (
    <section className="section-card device-lock-settings">
      <div className="device-lock-settings-heading">
        <span className="settings-icon" aria-hidden="true"><LockKeyhole size={20} /></span>
        <div>
          <p className="eyebrow">Device privacy</p>
          <h2>App Lock</h2>
          <p>
            Keep this installed iPhone app signed in, then protect its screen with a local passcode and optional Face ID or Touch ID.
          </p>
        </div>
        <span className={`device-lock-status ${config ? "enabled" : ""}`}>
          {config ? <><ShieldCheck size={15} /> On</> : "Off"}
        </span>
      </div>

      {config ? (
        <div className="device-lock-controls">
          <label>
            <span>Lock after leaving the app</span>
            <select
              onChange={(event) => updateTimeout(Number(event.target.value))}
              value={config.autoLockMs}
            >
              {autoLockOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="device-lock-actions">
            <button className="secondary-button" onClick={requestDeviceLock} type="button">
              <LockKeyhole size={16} /> Lock now
            </button>
            <button className="secondary-button" onClick={() => start("change")} type="button">
              <KeyRound size={16} /> Change passcode
            </button>
            {deviceAvailable && (
              <button
                className="secondary-button"
                onClick={() => start(config.biometricCredentialId ? "remove-biometric" : "biometric")}
                type="button"
              >
                <ScanFace size={16} />
                {config.biometricCredentialId ? "Remove device unlock" : "Set up Face ID / Touch ID"}
              </button>
            )}
            <button className="text-button danger-text" onClick={() => start("disable")} type="button">
              Turn off
            </button>
          </div>
        </div>
      ) : (
        <div className="device-lock-off">
          <div>
            <strong>Use the app without repeated email sign-in</strong>
            <span>Supabase keeps the secure session; App Lock protects access when someone has your device.</span>
          </div>
          <button className="primary-button compact-button" onClick={() => start("enable")} type="button">
            Set up passcode
          </button>
        </div>
      )}

      {operation && (
        <form className="device-lock-form" onSubmit={(event) => void submit(event)}>
          <div>
            <strong>{operationTitle(operation)}</strong>
            <span>{operationCopy(operation)}</span>
          </div>
          {operation !== "enable" && (
            <PasscodeInput label="Current passcode" value={currentPasscode} onChange={setCurrentPasscode} />
          )}
          {(operation === "enable" || operation === "change") && (
            <>
              <PasscodeInput label="New six-digit passcode" value={newPasscode} onChange={setNewPasscode} />
              <PasscodeInput label="Confirm passcode" value={confirmPasscode} onChange={setConfirmPasscode} />
            </>
          )}
          <div className="device-lock-form-actions">
            <button className="text-button" disabled={busy} onClick={() => resetForm()} type="button">Cancel</button>
            <button className="primary-button compact-button" disabled={busy} type="submit">
              {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
              Confirm
            </button>
          </div>
        </form>
      )}

      {error && <p className="device-setting-message error" role="alert">{error}</p>}
      {message && <p className="device-setting-message" role="status"><Check size={15} /> {message}</p>}
      <p className="device-lock-disclosure">
        This is a local privacy screen, not a replacement for your cloud sign-in. AssetTracker never receives or stores biometric data.
      </p>
    </section>
  );
}

function PasscodeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="device-setting-passcode">
      <span>{label}</span>
      <input
        autoComplete="off"
        inputMode="numeric"
        maxLength={6}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        pattern="[0-9]{6}"
        placeholder="••••••"
        required
        type="password"
        value={value}
      />
    </label>
  );
}

function operationTitle(operation: Exclude<Operation, null>) {
  switch (operation) {
    case "enable": return "Create your device passcode";
    case "change": return "Change device passcode";
    case "disable": return "Turn off App Lock";
    case "biometric": return "Enable device verification";
    case "remove-biometric": return "Remove device verification";
  }
}

function operationCopy(operation: Exclude<Operation, null>) {
  switch (operation) {
    case "enable": return "Choose a passcode that is different from your phone unlock code.";
    case "change": return "Confirm the current passcode before choosing a new one.";
    case "disable": return "Your Supabase sign-in remains active until you sign out.";
    case "biometric": return "Your iPhone or Mac will ask for Face ID, Touch ID or its device passcode.";
    case "remove-biometric": return "Passcode unlock will remain available.";
  }
}
