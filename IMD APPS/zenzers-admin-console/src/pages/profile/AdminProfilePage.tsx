import { useCallback, useEffect, useRef, useState } from 'react'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { ProgressBar } from 'primereact/progressbar'
import { Tag } from 'primereact/tag'
import { Divider } from 'primereact/divider'
import { adminApi, AdminProfile } from '@/api/admin'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
import { useAdminAuth } from '@/auth/useAdminAuth'

export function AdminProfilePage() {
  const { user } = useAdminAuth()
  const toast = useRef<Toast>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Editable form state
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    timezone: '',
    licenseNumber: '',
    specialty: '',
  })

  const loadProfile = useCallback(async () => {
    try {
      const data = await adminApi.getProfile()
      setProfile(data)
      setForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        timezone: data.timezone || '',
        licenseNumber: data.professional?.licenseNumber || '',
        specialty: data.professional?.specialty || '',
      })
      if (data.avatarKey) {
        setAvatarUrl(adminApi.getAvatarUrl(data.avatarKey))
      }
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Partial<AdminProfile> = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        timezone: form.timezone,
        professional: {
          licenseNumber: form.licenseNumber,
          specialty: form.specialty,
        },
      }
      const updated = await adminApi.updateProfile(payload)
      setProfile(prev => prev ? { ...prev, ...updated } : prev)
      setEditing(false)
      toast.current?.show({ severity: 'success', summary: 'Saved', detail: 'Profile updated' })
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to save profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.current?.show({ severity: 'warn', summary: 'Too large', detail: 'Avatar must be under 2MB' })
      return
    }
    try {
      const result = await adminApi.uploadAvatar(file)
      setAvatarUrl(adminApi.getAvatarUrl(result.key))
      setProfile(prev => prev ? { ...prev, avatarKey: result.key } : prev)
      toast.current?.show({ severity: 'success', summary: 'Uploaded', detail: 'Avatar updated' })
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to upload avatar' })
    }
  }

  const getInitials = () => {
    const first = profile?.firstName || user?.profile?.given_name || ''
    const last = profile?.lastName || user?.profile?.family_name || ''
    return ((first[0] || '') + (last[0] || '')).toUpperCase() || 'AD'
  }

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email
    : (user?.profile?.email ?? 'Admin')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="pi pi-spin pi-spinner text-3xl text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Toast ref={toast} />
      <ChangePasswordDialog
        visible={showPasswordDialog}
        onHide={() => setShowPasswordDialog(false)}
        onSuccess={() => toast.current?.show({ severity: 'success', summary: 'Password Changed', detail: 'Your password has been updated' })}
      />

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-blue-500">
                {getInitials()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
            >
              <i className="pi pi-camera text-lg" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">{displayName}</h1>
            <p className="text-sm text-slate-500">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Tag value="Admin" severity="info" />
              {profile?.twoFactorEnabled && <Tag value="2FA Enabled" severity="success" icon="pi pi-shield" />}
            </div>
          </div>

          {/* Completeness */}
          {profile?.profileCompleteness != null && (
            <div className="text-right min-w-[140px]">
              <p className="text-xs text-slate-500 mb-1">Profile Completeness</p>
              <ProgressBar
                value={Math.round(profile.profileCompleteness * 100)}
                showValue
                style={{ height: '0.5rem' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Personal Information</h2>
          {!editing ? (
            <Button label="Edit" icon="pi pi-pencil" severity="secondary" outlined size="small" onClick={() => setEditing(true)} />
          ) : (
            <div className="flex gap-2">
              <Button label="Cancel" severity="secondary" outlined size="small" onClick={() => { setEditing(false); loadProfile() }} disabled={saving} />
              <Button label="Save" icon="pi pi-check" size="small" onClick={handleSave} loading={saving} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">First Name</label>
            {editing ? (
              <InputText value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="w-full" />
            ) : (
              <p className="text-slate-800">{profile?.firstName || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Last Name</label>
            {editing ? (
              <InputText value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="w-full" />
            ) : (
              <p className="text-slate-800">{profile?.lastName || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <p className="text-slate-800">{profile?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
            {editing ? (
              <InputText value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full" />
            ) : (
              <p className="text-slate-800">{profile?.phone || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Timezone</label>
            {editing ? (
              <InputText value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} className="w-full" placeholder="e.g. America/Toronto" />
            ) : (
              <p className="text-slate-800">{profile?.timezone || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>
        </div>
      </div>

      {/* Professional Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Professional Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">License Number</label>
            {editing ? (
              <InputText value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} className="w-full" />
            ) : (
              <p className="text-slate-800">{profile?.professional?.licenseNumber || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Specialty</label>
            {editing ? (
              <InputText value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className="w-full" />
            ) : (
              <p className="text-slate-800">{profile?.professional?.specialty || <span className="text-slate-400 italic">Not set</span>}</p>
            )}
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Security</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Password</p>
            <p className="text-xs text-slate-500">Change your login password</p>
          </div>
          <Button label="Change Password" icon="pi pi-lock" severity="warning" outlined onClick={() => setShowPasswordDialog(true)} />
        </div>
        <Divider />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
            <p className="text-xs text-slate-500">
              {profile?.twoFactorEnabled ? 'Enabled — your account is secured with TOTP' : 'Not enabled — add an extra layer of security'}
            </p>
          </div>
          <Tag value={profile?.twoFactorEnabled ? 'Enabled' : 'Disabled'} severity={profile?.twoFactorEnabled ? 'success' : 'warning'} />
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">User ID</p>
            <p className="text-slate-800 font-mono text-xs">{profile?.sub || profile?.id}</p>
          </div>
          <div>
            <p className="text-slate-500">Last Login</p>
            <p className="text-slate-800">{profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : 'N/A'}</p>
          </div>
          <div>
            <p className="text-slate-500">Account Created</p>
            <p className="text-slate-800">{profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
