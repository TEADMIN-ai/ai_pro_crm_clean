'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { auth } from '@/lib/firebase/config';
import { createUserInFirestore } from '@/lib/firebase/createUserInFirestore';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      if (!auth) {
        throw new Error('Firebase auth not initialized');
      }

      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await createUserInFirestore(cred.user);

      router.push('/dashboard');
    } catch (err: any) {
      console.error('LOGIN ERROR', err);
      setError(err.code || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 400 }}>
      <h1>Login</h1>

      <input
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', marginBottom: 10, width: '100%' }}
      />

      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: 10, width: '100%' }}
      />

      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Signing in…' : 'Login'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}