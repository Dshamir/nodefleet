import { useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { adminApi } from '@/api/admin'

interface Props {
  visible: boolean
  onHide: () => void
  onSuccess?: () => void
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

export function ChangePasswordDialog({ visible, onHide, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const allRulesPassed = PASSWORD_RULES.every(r => r.test(newPassword))
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0
  const canSubmit = currentPassword.length > 0 && allRulesPassed && passwordsMatch && !loading

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await adminApi.changePassword({ currentPassword, newPassword, confirmPassword })
      setSuccess(true)
      setTimeout(() => {
        resetForm()
        onHide()
        onSuccess?.()
      }, 1500)
    } catch (err: any) {
      const body = err?.body ? JSON.parse(err.body) : {}
      setError(body.error || body.errors?.[0]?.msg || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess(false)
  }

  const handleHide = () => {
    resetForm()
    onHide()
  }

  return (
    <Dialog
      header="Change Password"
      visible={visible}
      onHide={handleHide}
      style={{ width: '28rem' }}
      modal
      closable={!loading}
    >
      <div className="flex flex-col gap-4">
        {error && <Message severity="error" text={error} className="w-full" />}
        {success && <Message severity="success" text="Password changed successfully!" className="w-full" />}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
          <Password
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            feedback={false}
            toggleMask
            className="w-full"
            inputClassName="w-full"
            disabled={loading || success}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
          <Password
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            feedback={false}
            toggleMask
            className="w-full"
            inputClassName="w-full"
            disabled={loading || success}
          />
          <ul className="mt-2 space-y-1">
            {PASSWORD_RULES.map((rule, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <i className={`pi ${rule.test(newPassword) ? 'pi-check-circle text-green-500' : 'pi-circle text-slate-300'}`} />
                <span className={rule.test(newPassword) ? 'text-green-700' : 'text-slate-500'}>{rule.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
          <Password
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            feedback={false}
            toggleMask
            className="w-full"
            inputClassName="w-full"
            disabled={loading || success}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button label="Cancel" severity="secondary" outlined onClick={handleHide} disabled={loading} />
          <Button label="Change Password" icon="pi pi-lock" onClick={handleSubmit} loading={loading} disabled={!canSubmit} />
        </div>
      </div>
    </Dialog>
  )
}
