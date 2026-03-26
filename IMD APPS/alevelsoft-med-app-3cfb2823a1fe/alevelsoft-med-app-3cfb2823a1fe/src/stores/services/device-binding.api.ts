import { createApi } from '@reduxjs/toolkit/dist/query/react'

import { baseQueryWithHandleError } from '../helpers/base-query-with-handle-error'

interface DeviceBindingRequest {
  deviceSerial: string
  userId: string
}

interface DeviceBindingResponse {
  id: string
  deviceSerial: string
  userId: string
  status: string
  createdAt: string
}

export const deviceBindingApi = createApi({
  reducerPath: 'deviceBindingApi',
  baseQuery: baseQueryWithHandleError,
  tagTypes: ['DeviceBinding'],
  endpoints: (build) => ({
    postDeviceBinding: build.mutation<DeviceBindingResponse, DeviceBindingRequest>({
      query: (body) => ({ url: '/device-binding', method: 'POST', body }),
      invalidatesTags: ['DeviceBinding'],
    }),
    getDeviceBinding: build.query<DeviceBindingResponse, string>({
      query: (deviceSerial) => ({ url: `/device-binding/${deviceSerial}` }),
      providesTags: ['DeviceBinding'],
    }),
  }),
})

export const {
  usePostDeviceBindingMutation,
  useGetDeviceBindingQuery,
} = deviceBindingApi
