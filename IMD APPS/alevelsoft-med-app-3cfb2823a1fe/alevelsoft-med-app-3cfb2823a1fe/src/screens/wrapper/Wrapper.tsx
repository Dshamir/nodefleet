import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { AvoidSoftInput } from 'react-native-avoid-softinput'
import { Loader } from 'src/components/loader'
import { EmergencyStack } from 'src/navigation/emergency.stack'
import { RecoveryStack } from 'src/navigation/recovery.stack'
import { isUserRoleGrantable, isUserRolePatient } from 'src/stores/helpers/user-role'
import { useAppDispatch, useInterval } from 'src/stores/hooks'
import { usePostRefreshTokenMutation } from 'src/stores/services/auth.api'
import {
  setAccessTokenExpireTime,
  setToken,
  useAccessTokenExpireTime,
  useIsAuthenticated,
  useIsDisplayRecovery,
  useIsExistEmergency,
  useIsLoadingExistEmergency,
  useRefreshToken,
  useRegisteredUserDeletedAt,
  useRegisteredUserRole,
} from 'src/stores/slices/auth.slice'
import { addErrorNotification } from 'src/stores/slices/notifications.slice'

import AuthStack from '../../navigation/auth.stack'
import DrawerStack from '../../navigation/drawer.stack'
import GrantedUserMainStack from '../../navigation/granted-user-stack/granted-user-main.stack'
import { ErrorBoundary } from './ErrorBoundary'

const WrapperInner = () => {
  const dispatch = useAppDispatch()
  const isAuth = useIsAuthenticated()
  const role = useRegisteredUserRole()
  const deletedAt = useRegisteredUserDeletedAt()
  const isDisplayRecovery = useIsDisplayRecovery()
  const isExistEmergency = useIsExistEmergency()
  const isLoadingExistEmergency = useIsLoadingExistEmergency()
  const refreshToken = useRefreshToken()
  const accessTokenExpireTime = useAccessTokenExpireTime()

  const [postRefreshToken] = usePostRefreshTokenMutation()

  const delay = useMemo(() => {
    const expireTime = accessTokenExpireTime * 1000

    if (accessTokenExpireTime > 0 && expireTime > dayjs().valueOf()) {
      console.log(dayjs().valueOf(), expireTime)

      return expireTime - dayjs().valueOf()
    }

    return 600000
  }, [accessTokenExpireTime])

  useInterval(() => {
    console.log(delay)
    if (isAuth && refreshToken && accessTokenExpireTime > 0 && delay > 0) {
      ;(async () => {
        try {
          const data = await postRefreshToken({ refreshToken }).unwrap()

          dispatch(setToken(data.accessToken))
          dispatch(setAccessTokenExpireTime(accessTokenExpireTime))
        } catch (error: any) {
          dispatch(setToken(''))
          dispatch(setAccessTokenExpireTime(0))
          dispatch(addErrorNotification(error.message))
        }
      })()
    }
  }, delay)

  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        try {
          const data = await postRefreshToken({ refreshToken }).unwrap()

          dispatch(setToken(data.accessToken))
          dispatch(setAccessTokenExpireTime(data.accessTokenExpireTime))
        } catch (error: any) {
          dispatch(addErrorNotification(error.message))
          dispatch(setToken(''))
          dispatch(setAccessTokenExpireTime(0))
        }
      }
    },
    [dispatch, postRefreshToken, refreshToken],
  )

  useEffect(() => {
    AvoidSoftInput.setEnabled(true)
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      sub.remove()
    }
  }, [dispatch, handleAppStateChange])

  if (!isAuth) {
    return <AuthStack />
  }

  if (deletedAt && isDisplayRecovery) {
    return <RecoveryStack />
  }

  if (isUserRolePatient(role) && !isExistEmergency && isLoadingExistEmergency !== null) {
    return <EmergencyStack />
  }

  if (
    isUserRolePatient(role) &&
    isLoadingExistEmergency === false &&
    isExistEmergency &&
    isLoadingExistEmergency !== null
  ) {
    return <DrawerStack />
  }

  if (isUserRoleGrantable(role)) {
    return <GrantedUserMainStack />
  }

  // If patient is authenticated but emergency contact state hasn't loaded yet,
  // show EmergencyStack as default (will redirect once contacts are checked)
  if (isUserRolePatient(role)) {
    return <EmergencyStack />
  }

  return <Loader />
}

const Wrapper = () => (
  <ErrorBoundary>
    <WrapperInner />
  </ErrorBoundary>
)

export { Wrapper }
