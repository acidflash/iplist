import axios from 'axios'
import type { Prefix, VLAN, IPAddress, Stats } from '../types'

const api = axios.create({ baseURL: '/api/v1' })

// Prefixes
export const getPrefixes = () => api.get<Prefix[]>('/prefixes').then(r => r.data)
export const getPrefix = (id: number) => api.get<Prefix>(`/prefixes/${id}`).then(r => r.data)
export const createPrefix = (data: Partial<Prefix>) => api.post<Prefix>('/prefixes', data).then(r => r.data)
export const updatePrefix = (id: number, data: Partial<Prefix>) => api.put<Prefix>(`/prefixes/${id}`, data).then(r => r.data)
export const deletePrefix = (id: number) => api.delete(`/prefixes/${id}`)

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

// Stats
export const getStats = () => api.get<Stats>('/stats').then(r => r.data)
