import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Demo account for reviewers. Set both in .env (and in Vercel → Settings →
// Environment Variables). If either is missing, the demo box is hidden.
// Only use a throwaway account here: anything in a VITE_ variable ends up in
// the public JavaScript bundle.
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD
const hasDemo = Boolean(DEMO_EMAIL && DEMO_PASSWORD)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function signIn(emailToUse, passwordToUse) {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password: passwordToUse })
    if (error) setError(error.message)
    setLoading(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    signIn(email, password)
  }

  function signInWithDemo() {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    signIn(DEMO_EMAIL, DEMO_PASSWORD)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold">TriageFlow</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in as a support agent</p>

        {hasDemo && (
          <div className="mt-5 rounded-lg border border-[var(--border)] bg-white p-3 text-sm">
            <p className="font-medium">Demo account</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              Email: <span className="font-mono text-[var(--text-primary)]">{DEMO_EMAIL}</span>
              <br />
              Password: <span className="font-mono text-[var(--text-primary)]">{DEMO_PASSWORD}</span>
            </p>
            <button
              type="button" onClick={signInWithDemo} disabled={loading}
              className="mt-3 w-full rounded-md border border-[var(--text-primary)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-1)] disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in with demo account'}
            </button>
          </div>
        )}

        <label className="mt-6 block text-sm font-medium" htmlFor="email">Email</label>
        <input
          id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">Password</label>
        <input
          id="password" type="password" required autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
        />
        {error && <p className="mt-3 text-sm text-[var(--status-critical)]" role="alert">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="mt-6 w-full rounded-md bg-[var(--text-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
