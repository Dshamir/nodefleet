import '~/assets/styles/styles.scss'

import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { keycloakGetCurrentUser, transformOidcUserToAuthData } from '~/services/keycloak-auth.service'
import { useAppDispatch, useAppSelector } from '~stores/hooks'
import { setHasEmergencyContacts, signInSuccess } from '~stores/slices/auth.slice'

import { AppRouter } from './app-router'

const App = () => {
  const dispatch = useAppDispatch()
  const authData = useAppSelector((state) => state.auth.data)
  const hasEmergencyContacts = useAppSelector((state) => state.auth.hasEmergencyContacts)

  // Restore Keycloak OIDC session on app load
  useEffect(() => {
    const restoreSession = async () => {
      // Only try to restore if we don't already have auth data from Redux Persist
      if (authData.accessToken) {
        console.log('Session already restored from Redux Persist')
        return
      }

      try {
        console.log('Attempting to restore Keycloak session...')
        const currentUser = await keycloakGetCurrentUser()

        if (currentUser && !currentUser.expired) {
          console.log('Keycloak session restored successfully')
          dispatch(signInSuccess(transformOidcUserToAuthData(currentUser)))
        } else {
          console.log('No active Keycloak session found')
        }
      } catch (error: any) {
        console.log('No active Keycloak session:', error)
      }
    }

    restoreSession()
  }, [dispatch, authData.accessToken])

  // Fetch emergency contacts for Patients on session restore (page refresh)
  useEffect(() => {
    if (!authData.accessToken || authData.user.role !== 'Patient' || hasEmergencyContacts !== null) {
      return
    }

    const fetchEmergencyContacts = async () => {
      try {
        const res = await fetch('/med-api/patient/emergency-contacts', {
          headers: { Authorization: `Bearer ${authData.accessToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          const hasContacts = (data.persons?.length > 0) || (data.organizations?.length > 0)
          dispatch(setHasEmergencyContacts(hasContacts))
        } else {
          dispatch(setHasEmergencyContacts(true)) // safe default
        }
      } catch {
        dispatch(setHasEmergencyContacts(true)) // safe default
      }
    }

    fetchEmergencyContacts()
  }, [dispatch, authData.accessToken, authData.user.role, hasEmergencyContacts])

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppRouter />
    </BrowserRouter>
  )
}

export default App
