export const DEVICE_LOCK_CHANGED_EVENT = "assettracker:device-lock-changed";

const CONFIG_KEY = "assettracker-device-lock-v1";
const ATTEMPTS_KEY = "assettracker-device-lock-attempts-v1";
const PASSCODE_ITERATIONS = 310_000;

export const autoLockOptions = [
  { value: 0, label: "Immediately" },
  { value: 60_000, label: "After 1 minute" },
  { value: 300_000, label: "After 5 minutes" },
  { value: 900_000, label: "After 15 minutes" },
] as const;

export type DeviceLockConfig = {
  version: 1;
  salt: string;
  passcodeHash: string;
  iterations: number;
  autoLockMs: number;
  biometricCredentialId?: string;
};

type AttemptState = {
  failures: number;
  lockedUntil: number;
};

export type PasscodeResult = {
  ok: boolean;
  lockedForMs: number;
  attemptsRemaining: number;
};

export function isSixDigitPasscode(value: string) {
  return /^\d{6}$/.test(value);
}

export function readDeviceLockConfig(): DeviceLockConfig | null {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "null");
    if (
      value?.version !== 1 ||
      typeof value.salt !== "string" ||
      typeof value.passcodeHash !== "string" ||
      typeof value.iterations !== "number" ||
      typeof value.autoLockMs !== "number"
    ) {
      return null;
    }
    return value as DeviceLockConfig;
  } catch {
    return null;
  }
}

export async function createDeviceLockConfig(
  passcode: string,
  previous?: DeviceLockConfig | null,
): Promise<DeviceLockConfig> {
  if (!isSixDigitPasscode(passcode)) {
    throw new Error("Use exactly six digits.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    version: 1,
    salt: toBase64URL(salt),
    passcodeHash: await derivePasscodeHash(
      passcode,
      salt,
      PASSCODE_ITERATIONS,
    ),
    iterations: PASSCODE_ITERATIONS,
    autoLockMs: previous?.autoLockMs ?? 60_000,
    biometricCredentialId: previous?.biometricCredentialId,
  };
}

export function saveDeviceLockConfig(config: DeviceLockConfig) {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  emitDeviceLockChange("changed");
}

export function clearDeviceLockConfig() {
  window.localStorage.removeItem(CONFIG_KEY);
  window.localStorage.removeItem(ATTEMPTS_KEY);
  emitDeviceLockChange("changed");
}

export function requestDeviceLock() {
  emitDeviceLockChange("lock");
}

export function setDeviceVerificationInProgress(active: boolean) {
  emitDeviceLockChange(active ? "verification-start" : "verification-end");
}

export async function verifyDevicePasscode(
  passcode: string,
): Promise<PasscodeResult> {
  const config = readDeviceLockConfig();
  if (!config) return { ok: true, lockedForMs: 0, attemptsRemaining: 5 };

  const attempt = readAttempts();
  const lockedForMs = Math.max(0, attempt.lockedUntil - Date.now());
  if (lockedForMs > 0) {
    return { ok: false, lockedForMs, attemptsRemaining: 0 };
  }

  const candidate = await derivePasscodeHash(
    passcode,
    fromBase64URL(config.salt),
    config.iterations,
  );
  if (constantTimeEqual(candidate, config.passcodeHash)) {
    window.localStorage.removeItem(ATTEMPTS_KEY);
    return { ok: true, lockedForMs: 0, attemptsRemaining: 5 };
  }

  const failures = attempt.failures + 1;
  const nextLockMs =
    failures >= 5
      ? Math.min(15 * 60_000, 30_000 * 2 ** Math.min(failures - 5, 5))
      : 0;
  writeAttempts({
    failures,
    lockedUntil: nextLockMs ? Date.now() + nextLockMs : 0,
  });
  return {
    ok: false,
    lockedForMs: nextLockMs,
    attemptsRemaining: Math.max(0, 5 - failures),
  };
}

export async function isDeviceVerificationAvailable() {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof PublicKeyCredential === "undefined" ||
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
      "function"
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerDeviceVerification() {
  if (!(await isDeviceVerificationAvailable())) {
    throw new Error("Face ID or Touch ID is not available in this browser.");
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "AssetTracker" },
      user: {
        id: randomBytes(32),
        name: "assettracker-local-owner",
        displayName: "AssetTracker owner",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        requireResidentKey: false,
        userVerification: "required",
      },
      timeout: 60_000,
      attestation: "none",
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Device verification could not be enabled.");
  }
  return toBase64URL(new Uint8Array(credential.rawId));
}

export async function verifyWithDevice(credentialId: string) {
  if (!(await isDeviceVerificationAvailable())) return false;

  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [
          {
            id: fromBase64URL(credentialId),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    if (!(credential instanceof PublicKeyCredential)) return false;
    return constantTimeEqual(
      toBase64URL(new Uint8Array(credential.rawId)),
      credentialId,
    );
  } catch {
    return false;
  }
}

function emitDeviceLockChange(
  reason: "changed" | "lock" | "verification-start" | "verification-end",
) {
  window.dispatchEvent(
    new CustomEvent(DEVICE_LOCK_CHANGED_EVENT, { detail: reason }),
  );
}

async function derivePasscodeHash(
  passcode: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    256,
  );
  return toBase64URL(new Uint8Array(bits));
}

function readAttempts(): AttemptState {
  try {
    const value = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? "null");
    return {
      failures: typeof value?.failures === "number" ? value.failures : 0,
      lockedUntil:
        typeof value?.lockedUntil === "number" ? value.lockedUntil : 0,
    };
  } catch {
    return { failures: 0, lockedUntil: 0 };
  }
}

function writeAttempts(value: AttemptState) {
  window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(value));
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function constantTimeEqual(left: string, right: string) {
  const maximum = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maximum; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function toBase64URL(bytes: Uint8Array) {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64URL(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
