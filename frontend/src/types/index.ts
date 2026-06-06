export type Status = 'active' | 'reserved' | 'deprecated'

export interface VLAN {
  id: number
  vid: number
  name: string
  description: string
  status: Status
  created_at: string
  updated_at: string
  prefixes?: Prefix[]
}

export interface NetworkInfo {
  version: 4 | 6
  network: string
  broadcast?: string
  netmask?: string
  wildcard?: string
  first_host: string
  last_host: string
  total_hosts: string
}

export interface Prefix {
  id: number
  prefix: string
  name: string
  description: string
  status: Status
  parent_id: number | null
  vlan_id: number | null
  created_at: string
  updated_at: string
  utilization: number
  total_ips: number
  used_ips: number
  children?: Prefix[]
  addresses?: IPAddress[]
  vlan?: VLAN
  net_info?: NetworkInfo
}

export interface IPAddress {
  id: number
  address: string
  prefix_id: number | null
  hostname: string
  description: string
  status: Status
  dns_name: string
  created_at: string
  updated_at: string
}

export interface Stats {
  total_prefixes: number
  total_vlans: number
  total_addresses: number
  utilization: number
}

export interface SubnetInfo {
  subnet: string
  hosts: string
  allocated: boolean
  prefix_id?: number
}

export interface SplitResponse {
  parent: string
  new_prefix_len: number
  total_count: string
  subnets: SubnetInfo[]
  truncated: boolean
}
