import { Container } from '@mui/material'
import React, { useCallback, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageUrls } from '~/enums/page-urls.enum'
import { IAuthData } from '~models/auth.model'
import { useAppDispatch } from '~stores/hooks'
import { setUserData, useHasEmergencyContacts, useIsAuth, useUserDeletedAt, useUserRole } from '~stores/slices/auth.slice'
import { useEmergencyContactIsLoading } from '~stores/slices/emergency-contact.slice'
import { combineApi } from '~stores/store'

import { Header } from '../Header/header'

export const DefaultLayout = () => {
  const dispatch = useAppDispatch()
  const isAuth = useIsAuth()
  const userDeletedAt = useUserDeletedAt()
  const location = useLocation()
  const userRole = useUserRole()
  const hasEmergencyContacts = useHasEmergencyContacts()
  const emergencyContactIsLoading = useEmergencyContactIsLoading()

  useEffect(() => {
    if (!isAuth) {
      combineApi.map((api) => {
        dispatch(api.util.resetApiState())
      })
    }
  }, [dispatch, isAuth])

  const handleStorage = useCallback(
    (event: StorageEvent) => {
      if (event.key === 'persist:root') {
        const persistStorage = localStorage.getItem('persist:root')

        if (persistStorage) {
          const persistData = JSON.parse(JSON.parse(persistStorage).data) as IAuthData

          dispatch(setUserData(persistData))
        }
      }
    },
    [dispatch],
  )

  useEffect(() => {
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [handleStorage, dispatch])

  if (userDeletedAt && location.pathname !== PageUrls.AccountRecovery) {
    return <Navigate replace to={PageUrls.AccountRecovery} />
  }

  if (isAuth && userRole === 'Patient' && !emergencyContactIsLoading && !hasEmergencyContacts) {
    return <Navigate replace to={PageUrls.AddEmergencyContact} />
  }

  if (!isAuth) {
    return <Navigate replace to={PageUrls.SignIn} />
  }

  return (
    <>
      <Header />
      <Container sx={{ mb: 3 }}>
        <Outlet />
      </Container>
    </>
  )
}
