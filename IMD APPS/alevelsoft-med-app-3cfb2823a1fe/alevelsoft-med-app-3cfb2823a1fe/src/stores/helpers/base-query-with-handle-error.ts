import { BaseQueryApi } from '@reduxjs/toolkit/dist/query/baseQueryTypes'
import { FetchArgs, fetchBaseQuery } from '@reduxjs/toolkit/dist/query/react'

import { constants } from '../../constants'
import { callLogOut } from '../store'
import { prepareHeaders } from './prepare-headers'
import { RootState } from '../store'
import { setAccessTokenExpireTime, setRefreshToken, setToken } from '../slices/auth.slice'

const baseUrl = constants.BASE_URL

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(api: BaseQueryApi): Promise<boolean> {
  const state = api.getState() as RootState
  const refreshToken = state.auth.refreshToken

  if (!refreshToken) return false

  const baseQuery = fetchBaseQuery({ baseUrl })
  const refreshResult = await baseQuery(
    {
      url: '/refresh-token',
      method: 'POST',
      body: { refreshToken },
    },
    api,
    {},
  )

  if (refreshResult.data) {
    const data = refreshResult.data as {
      accessToken: string
      accessTokenExpireTime: number
      refreshToken: string
    }
    api.dispatch(setToken(data.accessToken))
    api.dispatch(setAccessTokenExpireTime(data.accessTokenExpireTime))
    api.dispatch(setRefreshToken(data.refreshToken))
    return true
  }

  return false
}

export const baseQueryWithHandleError = async (args: string | FetchArgs, api: BaseQueryApi, extraOptions: {}) => {
  const baseQuery = fetchBaseQuery({ baseUrl, prepareHeaders })
  let result = await baseQuery(args, api, extraOptions)

  if (result.error?.status === 401) {
    // Avoid multiple concurrent refresh attempts — coalesce into one
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = tryRefreshToken(api).finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false))

    if (refreshed) {
      // Retry the original request with the new token
      result = await baseQuery(args, api, extraOptions)
    } else {
      await callLogOut()
    }
  }

  return result
}
