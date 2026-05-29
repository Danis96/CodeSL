import { useState } from 'react';
import type { FirebaseError } from 'firebase/app';
import { Terminal, Mail, Lock, Eye, EyeOff, ArrowRight, Chrome } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../data/workspace-context';

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useWorkspace();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const notifyError = (err: unknown) => {
    const message = getAuthErrorMessage(err);
    toast.error(message);
  };

  const notifySuccess = (message: string) => {
    toast.success(message);
  };

  const validateFields = () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      toast.error('Enter your email first.');
      return false;
    }

    if (!isValidEmail(normalizedEmail)) {
      toast.error('Enter a valid email address.');
      return false;
    }

    if (mode === 'signup' && !name.trim()) {
      toast.error('Enter your full name.');
      return false;
    }

    if (mode !== 'forgot') {
      if (!password.trim()) {
        toast.error('Enter your password.');
        return false;
      }

      if (password.length < 8) {
        toast.error('Password must be at least 8 characters.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateFields()) {
      return;
    }

    setLoading(true);

    try {
      if (mode === 'forgot') {
        await resetPassword(email);
        notifySuccess('Password reset email sent.');
      } else if (mode === 'signup') {
        await signUpWithEmail(name, email, password);
        notifySuccess('Account created. You are now signed in.');
      } else {
        await signInWithEmail(email, password);
        notifySuccess('Signed in successfully.');
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="matrix-shell flex min-h-screen items-center justify-center relative overflow-hidden"
      style={{ background: '#050805' }}
    >
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140,255,90,0.08) 0%, transparent 70%)',
          top: '-200px', left: '50%', transform: 'translateX(-50%)',
        }} />
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(98,255,191,0.06) 0%, transparent 70%)',
          bottom: '-100px', right: '20%',
        }} />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(121,255,102,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(121,255,102,0.04) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{
              width: '56px', height: '56px',
              background: 'rgba(12, 28, 12, 0.92)',
              border: '1px solid rgba(140,255,90,0.42)',
              boxShadow: '0 0 24px rgba(140,255,90,0.18)',
            }}
          >
            <Terminal size={24} style={{ color: '#8cff5a' }} />
          </div>
          <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '28px', fontWeight: 800, letterSpacing: '0.1em' }}>
            SlaveCode
          </h1>
          <p className="matrix-muted" style={{ fontSize: '14px', marginTop: '4px' }}>
            {mode === 'login' ? 'Sign in to your workspace' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        {/* Card */}
        <div
          className="matrix-panel rounded-3xl p-8"
          style={{
            backdropFilter: 'blur(24px)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          }}
        >
          {mode === 'forgot' ? (
            <>
              <p className="matrix-copy" style={{ fontSize: '14px', marginBottom: '20px' }}>
                Enter your email to receive a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <DarkInput icon={<Mail size={14} />} type="email" placeholder="Email address" value={email} onChange={setEmail} />
                <SubmitButton loading={loading} label="Send Reset Link" />
              </form>
              <button onClick={() => setMode('login')} className="mt-4 w-full text-center hover:opacity-70 transition-opacity" style={{ color: '#5e7f58', fontSize: '13px' }}>
                ← Back to sign in
              </button>
            </>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await signInWithGoogle();
                    notifySuccess('Signed in with Google.');
                  } catch (err) {
                    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'auth/popup-closed-by-user') {
                      return;
                    }
                    notifyError(err);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-3 rounded-2xl py-3 mb-5 transition-all hover:opacity-80 active:scale-95"
                style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#e2ffd8', fontSize: '14px', fontWeight: 500 }}
              >
                <Chrome size={17} />
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div style={{ flex: 1, height: '1px', background: 'rgba(121,255,102,0.08)' }} />
                <span className="matrix-muted" style={{ fontSize: '12px' }}>or continue with email</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(121,255,102,0.08)' }} />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'signup' && (
                  <DarkInput icon={null} type="text" placeholder="Full name" value={name} onChange={setName} />
                )}
                <DarkInput icon={<Mail size={14} />} type="email" placeholder="Email address" value={email} onChange={setEmail} />
                <div className="relative">
                  <DarkInput icon={<Lock size={14} />} type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={setPassword} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
                    style={{ color: '#5e7f58' }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setMode('forgot')} className="hover:opacity-70 transition-opacity" style={{ color: '#8cff5a', fontSize: '13px', fontWeight: 500 }}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <div className="pt-1">
                  <SubmitButton loading={loading} label={mode === 'login' ? 'Sign In' : 'Create Account'} />
                </div>
              </form>

              <p className="mt-5 text-center" style={{ color: '#5e7f58', fontSize: '13px' }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="hover:opacity-70 transition-opacity" style={{ color: '#8cff5a', fontWeight: 600 }}>
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center" style={{ color: '#3f5e3b', fontSize: '12px' }}>
          By continuing, you agree to our <span style={{ color: '#5e7f58' }}>Terms</span> &amp; <span style={{ color: '#5e7f58' }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAuthErrorMessage(err: unknown) {
  const fallback = 'Authentication failed. Try again.';
  const code = (err as FirebaseError | undefined)?.code;

  switch (code) {
    case 'auth/invalid-email':
      return 'Email address invalid.';
    case 'auth/missing-password':
      return 'Password missing.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password incorrect.';
    case 'auth/email-already-in-use':
      return 'Email already used by another account.';
    case 'auth/weak-password':
      return 'Password too weak. Use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a bit, then try again.';
    case 'auth/popup-blocked':
      return 'Popup blocked by browser. Allow popups and retry.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup closed.';
    case 'auth/account-exists-with-different-credential':
      return 'Account exists with different sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error. Check connection and retry.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase yet.';
    default:
      return err instanceof Error ? err.message || fallback : fallback;
  }
}

function DarkInput({ icon, type, placeholder, value, onChange }: { icon: React.ReactNode; type: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 transition-all"
      style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', height: '46px' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(140,255,90,0.5)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(121,255,102,0.12)')}
    >
      {icon && <span style={{ color: '#5e7f58', flexShrink: 0 }}>{icon}</span>}
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent outline-none"
        style={{ color: '#e2ffd8', fontSize: '14px' }}
      />
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 transition-all hover:opacity-90 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, rgba(120,255,99,0.16) 0%, rgba(72,168,66,0.26) 100%)',
        border: '1px solid rgba(121,255,102,0.18)',
        color: '#e8ffe1', fontSize: '14px', fontWeight: 600,
        boxShadow: '0 0 24px rgba(90,255,90,0.12)',
      }}
    >
      {loading ? (
        <div className="rounded-full border-2 border-white/30 animate-spin" style={{ width: '16px', height: '16px', borderTopColor: 'white' }} />
      ) : (
        <>{label}<ArrowRight size={15} /></>
      )}
    </button>
  );
}
