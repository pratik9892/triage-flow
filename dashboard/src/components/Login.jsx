import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold">TriageFlow</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in as a support agent</p>

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
