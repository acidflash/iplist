import axios from 'axios'
import type { Prefix, VLAN, IPAddress, Stats, SplitResponse } from '../types'

const api = axios.create({ baseURL: '/api/v1' })

// Attach JWT from localStorage on every request
api.interceptors.request.use(config => {
  try {
    const raw = localStorage.getItem('iplist_auth')
    if (raw) {
      const { token } = JSON.parse(raw)
      if (token) config.headers.Authorization = `Bearer ${token}`
    }
  } catch { /* ignore */ }
  return config
})

// On 401, clear stored auth and reload to show login
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('iplist_auth')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

// Prefixes
export const getPrefixes = () => api.get<Prefix[]>('/prefixes').then(r => r.data)
export const getPrefix = (id: number) => api.get<Prefix>(`/prefixes/${id}`).then(r => r.data)
export const createPrefix = (data: Partial<Prefix>) => api.post<Prefix>('/prefixes', data).then(r => r.data)
export const updatePrefix = (id: number, data: Partial<Prefix>) => api.put<Prefix>(`/prefixes/${id}`, data).then(r => r.data)
export const deletePrefix = (id: number) => api.delete(`/prefixes/${id}`)
export const getSubnets = (id: number, prefixLen: number) =>
  api.get<SplitResponse>(`/prefixes/${id}/subnets`, { params: { prefix_len: prefixLen } }).then(r => r.data)

// VLANs
export const getVLANs = () => api.get<VLAN[]>('/vlans').then(r => r.data)
export const getVLAN = (id: number) => api.get<VLAN>(`/vlans/${id}`).then(r => r.data)
export const createVLAN = (data: Partial<VLAN>) => api.post<VLAN>('/vlans', data).then(r => r.data)
export const updateVLAN = (id: number, data: Partial<VLAN>) => api.put<VLAN>(`/vlans/${id}`, data).then(r => r.data)
export const deleteVLAN = (id: number) => api.delete(`/vlans/${id}`)

// Addresses
export const getAddresses = (params?: { prefix_id?: number; status?: string }) =>
  api.get<IPAddress[]>('/addresses', { params }).then(r => r.data)
export const getAddress = (id: number) => api.get<IPAddress>(`/addresses/${id}`).then(r => r.data)
export const createAddress = (data: Partial<IPAddress>) => api.post<IPAddress>('/addresses', data).then(r => r.data)
export const updateAddress = (id: number, data: Partial<IPAddress>) => api.put<IPAddress>(`/addresses/${id}`, data).then(r => r.data)
export const deleteAddress = (id: number) => api.delete(`/addresses/${id}`)

// Import
export interface ImportResult {
  imported: number
  skipped: number
  errors: { row: number; error: string }[]
}

const csvForm = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return fd
}

export const importVLANs = (file: File) =>
  api.post<ImportResult>('/vlans/import', csvForm(file), { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
export const importAddresses = (file: File) =>
  api.post<ImportResult>('/addresses/import', csvForm(file), { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)

// Stats
export const getStats = () => api.get<Stats>('/stats').then(r => r.data)

// Users
export interface UserData { id: number; username: string; role: string; created_at: string; updated_at: string }
export const getUsers = () => api.get<UserData[]>('/users').then(r => r.data)
export const createUser = (data: { username: string; password: string; role: string }) =>
  api.post<UserData>('/users', data).then(r => r.data)
export const updateUser = (id: number, data: { password?: string; role?: string }) =>
  api.put(`/users/${id}`, data)
export const deleteUser = (id: number) => api.delete(`/users/${id}`)
