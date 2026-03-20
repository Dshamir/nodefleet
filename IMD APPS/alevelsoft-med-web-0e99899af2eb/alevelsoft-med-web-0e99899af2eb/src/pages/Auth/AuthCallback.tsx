import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { keycloakHandleCallback, transformOidcUserToAuthData } from '~/services/keycloak-auth.service'
import { useAppDispatch } from '~stores/hooks'
import { setHasEmergencyContacts, signInSuccess } from '~stores/slices/auth.slice'

export const AuthCallback = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  useEffect(() => {
    keycloakHandleCallback()
      .then(async (user) => {
        if (user) {
          const authData = transformOidcUserToAuthData(user)
          dispatch(signInSuccess(authData))

          // Fetch emergency contacts for Patients to avoid redirect loop
          if (authData.user.role === 'Patient') {
            try {
              const res = await fetch('/med-api/patient/emergency-contacts', {
                headers: { Authorization: `Bearer ${authData.accessToken}` },
              })
              if (res.ok) {
                const data = await res.json()
                const hasContacts = (data.persons?.length > 0) || (data.organizations?.length > 0)
                dispatch(setHasEmergencyContacts(hasContacts))
              } else {
                dispatch(setHasEmergencyContacts(true)) // safe default to avoid loop
              }
            } catch {
              dispatch(setHasEmergencyContacts(true)) // safe default to avoid loop
            }
          }

          navigate('/', { replace: true })
        }
      })
      .catch((err) => {
        console.error('Auth callback failed:', err)
        navigate('/sign-in', { replace: true })
      })
  }, [dispatch, navigate])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Completing sign in...</p>
    </div>
  )
}
