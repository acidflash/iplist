function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvRow(values: (string | number | null | undefined)[]) {
  return values
    .map(v => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    })
    .join(',')
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]) {
  return [csvRow(headers), ...rows.map(csvRow)].join('\n')
}

function toYAML(data: object[]): string {
  const lines: string[] = []
  for (const item of data) {
    lines.push('-')
    for (const [k, v] of Object.entries(item)) {
      if (v == null) {
        lines.push(`  ${k}: null`)
      } else if (typeof v === 'number') {
        lines.push(`  ${k}: ${v}`)
      } else if (typeof v === 'boolean') {
        lines.push(`  ${k}: ${v}`)
      } else {
        const s = String(v)
        const needsQuote = s.includes(':') || s.includes('#') || s.includes("'") || s === ''
        lines.push(`  ${k}: ${needsQuote ? `"${s.replace(/"/g, '\\"')}"` : s}`)
      }
    }
  }
  return lines.join('\n')
}

// ── Prefixes ──────────────────────────────────────────────────────────────────

interface PrefixFlat {
  id: number; prefix: string; name: string; description: string; status: string
  parent_id: number | null; vlan_id: number | null; vlan_vid: number | null; vlan_name: string
  total_ips: number; used_ips: number; utilization: string; created_at: string
}

function flattenPrefix(p: {
  id: number; prefix: string; name: string; description: string; status: string
  parent_id: number | null; vlan_id: number | null; total_ips: number; used_ips: number
  utilization: number; created_at: string; vlan?: { vid: number; name: string } | null
}): PrefixFlat {
  return {
    id: p.id, prefix: p.prefix, name: p.name, description: p.description, status: p.status,
    parent_id: p.parent_id, vlan_id: p.vlan_id,
    vlan_vid: p.vlan?.vid ?? null, vlan_name: p.vlan?.name ?? '',
    total_ips: p.total_ips, used_ips: p.used_ips,
    utilization: `${p.utilization.toFixed(1)}%`,
    created_at: p.created_at,
  }
}

export function exportPrefixes(
  prefixes: Parameters<typeof flattenPrefix>[0][],
  format: 'csv' | 'json' | 'yaml',
  filename = 'prefix'
) {
  const flat = prefixes.map(flattenPrefix)
  const ts = new Date().toISOString().slice(0, 10)
  const name = `${filename}_${ts}`

  if (format === 'json') {
    download(JSON.stringify(flat, null, 2), `${name}.json`, 'application/json')
  } else if (format === 'yaml') {
    download(toYAML(flat as unknown as object[]), `${name}.yaml`, 'text/yaml')
  } else {
    const headers = ['id','prefix','name','description','status','parent_id','vlan_id','vlan_vid','vlan_name','total_ips','used_ips','utilization','created_at']
    const rows = flat.map(p => headers.map(h => (p as Record<string, unknown>)[h] as string | number | null))
    download(toCSV(headers, rows), `${name}.csv`, 'text/csv')
  }
}

// ── VLANs ─────────────────────────────────────────────────────────────────────

export function exportVLANs(
  vlans: { id: number; vid: number; name: string; description: string; status: string; created_at: string }[],
  format: 'csv' | 'json' | 'yaml',
  filename = 'vlan'
) {
  const ts = new Date().toISOString().slice(0, 10)
  const name = `${filename}_${ts}`

  if (format === 'json') {
    download(JSON.stringify(vlans, null, 2), `${name}.json`, 'application/json')
  } else if (format === 'yaml') {
    download(toYAML(vlans as unknown as object[]), `${name}.yaml`, 'text/yaml')
  } else {
    const headers = ['id','vid','name','description','status','created_at']
    const rows = vlans.map(v => [v.id, v.vid, v.name, v.description, v.status, v.created_at])
    download(toCSV(headers, rows), `${name}.csv`, 'text/csv')
  }
}

// ── Addresses ─────────────────────────────────────────────────────────────────

export function exportAddresses(
  addresses: { id: number; address: string; hostname: string; dns_name: string; description: string; status: string; prefix_id: number | null; created_at: string }[],
  prefixMap: Map<number, { prefix: string }>,
  format: 'csv' | 'json' | 'yaml',
  filename = 'ip_adresser'
) {
  const ts = new Date().toISOString().slice(0, 10)
  const name = `${filename}_${ts}`
  const flat = addresses.map(a => ({
    ...a,
    prefix: a.prefix_id ? (prefixMap.get(a.prefix_id)?.prefix ?? '') : '',
  }))

  if (format === 'json') {
    download(JSON.stringify(flat, null, 2), `${name}.json`, 'application/json')
  } else if (format === 'yaml') {
    download(toYAML(flat as unknown as object[]), `${name}.yaml`, 'text/yaml')
  } else {
    const headers = ['id','address','hostname','dns_name','description','status','prefix_id','prefix','created_at']
    const rows = flat.map(a => [a.id, a.address, a.hostname, a.dns_name, a.description, a.status, a.prefix_id, a.prefix, a.created_at])
    download(toCSV(headers, rows), `${name}.csv`, 'text/csv')
  }
}
