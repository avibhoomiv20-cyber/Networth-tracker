"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, LockKeyhole, ScanFace } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEVICE_LOCK_CHANGED_EVENT,
  clearDeviceLockConfig,
  isDeviceVerificationAvailable,
  readDeviceLockConfig,
  verifyDevicePasscode,
  verifyWithDevice,
  type DeviceLockConfig,
} from "@/lib/security/deviceLock";

export function DeviceLockGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<DeviceLockConfig | null>(null);
  const configRef = useRef<DeviceLockConfig | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const verifyingDevice = useRef(false);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);

  const reloadConfig = useCallback((shouldLock: boolean) => {
    const next = readDeviceLockConfig();
    configRef.current = next;
    setConfig(next);
    setLocked(next ? shouldLock : false);
    setReady(true);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => reloadConfig(true), 0);

    const onLockChange = (event: Event) => {
      const reason = (event as CustomEvent<string>).detail;
      if (reason === "verification-start") {
        verifyingDevice.current = true;
        return;
      }
      if (reason === "verification-end") {
        verifyingDevice.current = false;
        hiddenAt.current = null;
        return;
      }
      reloadConfig(reason === "lock");
    };
    const onStorage = () => reloadConfig(Boolean(readDeviceLockConfig()));
    const onVisibility = () => {
      const activeConfig = configRef.current;
      if (!activeConfig || verifyingDevice.current) return;

      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        if (activeConfig.autoLockMs === 0) setLocked(true);
        return;
      }

      if (
        hiddenAt.current !== null &&
        Date.now() - hiddenAt.current >= activeConfig.autoLockMs
      ) {
        setLocked(true);
      }
      hiddenAt.current = null;
    };

    window.addEventListener(DEVICE_LOCK_CHANGED_EVENT, onLockChange);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener(DEVICE_LOCK_CHANGED_EVENT, onLockChange);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reloadConfig]);

  if (!ready) {
    return (
      <main className="device-lock-page" aria-busy="true">
        <BrandMark size="large" />
        <LoaderCircle className="spin" size={24} />
        <p>Protecting your portfolio…</p>
      </main>
    );
  }

  if (locked && config) {
    return (
      <DeviceLockScreen
        config={config}
        onDeviceVerificationChange={(active) => {
          verifyingDevice.current = active;
        }}
        onUnlock={() => setLocked(false)}
      />
    );
  }

  return children;
}

function DeviceLockScreen({
  config,
  onUnlock,
  onDeviceVerificationChange,
}: {
  config: DeviceLockConfig;
  onUnlock: () => void;
  onDeviceVerificationChange: (active: boolean) => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deviceAvailable, setDeviceAvailable] = useState(false);

  useEffect(() => {
    void isDeviceVerificationAvailable().then(setDeviceAvailable);
  }, []);

  const unlockWithPasscode = async () => {
    if (busy) return;
    if (!/^\d{6}$/.test(passcode)) {
      setError("Enter your six-digit passcode.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await verifyDevicePasscode(passcode);
    if (result.ok) {
      onUnlock();
      return;
    }

    setPasscode("");
    setError(
      result.lockedForMs > 0
        ? `Too many attempts. Try again in ${Math.ceil(result.lockedForMs / 1000)} seconds.`
        : `Passcode not recognised. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? "" : "s"} remaining.`,
    );
    setBusy(false);
  };

  const unlockWithDevice = async () => {
    if (!config.biometricCredentialId || busy) return;
    setBusy(true);
    setError("");
    onDeviceVerificationChange(true);
    const verified = await verifyWithDevice(config.biometricCredentialId);
    onDeviceVerificationChange(false);
    if (verified) {
      onUnlock();
      return;
    }
    setError("Device verification was not completed. Use your passcode to continue.");
    setBusy(false);
  };

  const signOut = async () => {
    setBusy(true);
    const result = await getSupabaseClient()?.auth.signOut();
    if (result?.error) {
      setError("Could not sign out. Check your connection and try again.");
      setBusy(false);
      return;
    }
    clearDeviceLockConfig();
    window.location.replace("/");
  };

  return (
    <main className="device-lock-page">
      <section className="device-lock-card" aria-labelledby="device-lock-title">
        <BrandMark size="large" />
        <span className="device-lock-icon" aria-hidden="true">
          <LockKeyhole size={27} />
        </span>
        <p className="eyebrow">Private on this device</p>
        <h1 id="device-lock-title">AssetTracker is locked</h1>
        <p className="device-lock-copy">
          Your cloud session is still signed in. Unlock this device to view your portfolio.
        </p>

        {config.biometricCredentialId && deviceAvailable && (
          <button
            className="primary-button device-unlock-button"
            disabled={busy}
            onClick={() => void unlockWithDevice()}
            type="button"
          >
            <ScanFace size={18} /> Use Face ID or Touch ID
          </button>
        )}

        <div className="device-lock-divider"><span>or use passcode</span></div>
        <label className="device-passcode-field">
          <span>Six-digit passcode</span>
          <input
            autoComplete="off"
            autoFocus
            disabled={busy}
            inputMode="numeric"
            maxLength={6}
            onChange={(event) =>
              setPasscode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") void unlockWithPasscode();
            }}
            pattern="[0-9]*"
            placeholder="••••••"
            type="password"
            value={passcode}
          />
        </label>
        <button
          className="secondary-button device-passcode-button"
          disabled={busy || passcode.length !== 6}
          onClick={() => void unlockWithPasscode()}
          type="button"
        >
          {busy && <LoaderCircle className="spin" size={17} />}
          Unlock
        </button>
        {error && <p className="device-lock-error" role="alert">{error}</p>}
        <button className="device-sign-out" disabled={busy} onClick={() => void signOut()} type="button">
          Forgot passcode? Sign out and reset App Lock
        </button>
      </section>
    </main>
  );
}
