// WebAuthn Client Helper for Biometric Login (Face ID / Touch ID / Fingerprint)

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

// Convert ArrayBuffer / Uint8Array to base64url string
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Convert base64url string back to Uint8Array
export function base64UrlToBuffer(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register Biometric Credential for the current logged in user
export async function registerBiometricCredential(): Promise<{ ok: boolean; message: string }> {
  if (!isWebAuthnAvailable()) {
    return { ok: false, message: 'Biometric authentication is not supported on this browser or device.' };
  }

  try {
    // 1. Get challenge & registration options from server
    const optionsRes = await fetch('/api/auth/webauthn/register-options');
    if (!optionsRes.ok) {
      const errData = await optionsRes.json();
      throw new Error(errData.error || 'Failed to initialize biometric registration.');
    }
    const options = await optionsRes.json();

    // Prepare PublicKeyCredentialCreationOptions
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64UrlToBuffer(options.challenge).buffer as ArrayBuffer,
      rp: {
        name: options.rpName || 'IRLog',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(String(options.user.id)),
        name: options.user.username,
        displayName: options.user.username,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Built-in Face ID / Touch ID / Fingerprint
        userVerification: 'preferred',
      },
      timeout: 60000,
    };

    // 2. Trigger native device biometric prompt
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Biometric registration was cancelled or failed.');
    }

    const rawId = bufferToBase64Url(credential.rawId);
    const response = credential.response as AuthenticatorAttestationResponse;
    const clientDataJSON = bufferToBase64Url(response.clientDataJSON);
    const attestationObject = bufferToBase64Url(response.attestationObject);

    // 3. Send credential data back to server to save
    const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: credential.id,
        rawId,
        clientDataJSON,
        attestationObject,
      }),
    });

    if (!verifyRes.ok) {
      const verifyErr = await verifyRes.json();
      throw new Error(verifyErr.error || 'Failed to verify biometric registration.');
    }

    return { ok: true, message: 'Biometric login successfully registered for this device!' };
  } catch (err: any) {
    console.error('WebAuthn Registration Error:', err);
    return { ok: false, message: err.message || 'Biometric registration failed.' };
  }
}

// Authenticate via Biometric Login on Login page
export async function loginWithBiometrics(): Promise<{ ok: boolean; username?: string; message?: string }> {
  if (!isWebAuthnAvailable()) {
    return { ok: false, message: 'Biometric authentication is not supported on this browser or device.' };
  }

  try {
    // 1. Get login challenge from server
    const optionsRes = await fetch('/api/auth/webauthn/login-options');
    if (!optionsRes.ok) {
      throw new Error('Failed to start biometric login.');
    }
    const options = await optionsRes.json();

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64UrlToBuffer(options.challenge).buffer as ArrayBuffer,
      timeout: 60000,
      rpId: window.location.hostname,
      userVerification: 'preferred',
    };

    // 2. Trigger device biometric prompt (Face ID / Fingerprint)
    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error('Biometric authentication was cancelled.');
    }

    const rawId = bufferToBase64Url(assertion.rawId);
    const response = assertion.response as AuthenticatorAssertionResponse;
    const clientDataJSON = bufferToBase64Url(response.clientDataJSON);
    const authenticatorData = bufferToBase64Url(response.authenticatorData);
    const signature = bufferToBase64Url(response.signature);

    // 3. Verify assertion with server
    const verifyRes = await fetch('/api/auth/webauthn/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: assertion.id,
        rawId,
        clientDataJSON,
        authenticatorData,
        signature,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.ok) {
      throw new Error(verifyData.error || 'Biometric authentication failed.');
    }

    return { ok: true, username: verifyData.username };
  } catch (err: any) {
    console.error('WebAuthn Login Error:', err);
    return { ok: false, message: err.message || 'Biometric login failed.' };
  }
}
