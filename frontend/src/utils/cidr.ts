function expandIPv6(addr: string): string | null {
  const halves = addr.split('::')
  if (halves.length > 2) return null
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : []
    const right = halves[1] ? halves[1].split(':') : []
    const missing = 8 - left.length - right.length
    if (missing < 0) return null
    const mid = Array<string>(missing).fill('0000')
    return [...left, ...mid, ...right].map(g => g.padStart(4, '0')).join(':')
  }
  const parts = addr.split(':')
  if (parts.length !== 8) return null
  return parts.map(g => g.padStart(4, '0')).join(':')
}

function formatIPv6(n: bigint): string {
  return (n.toString(16).padStart(32, '0').match(/.{4}/g) ?? []).join(':')
}

export function validateCIDR(value: string): string {
  if (!value || !value.includes('/')) return ''
  const slash = value.lastIndexOf('/')
  const addr = value.slice(0, slash)
  const len = parseInt(value.slice(slash + 1), 10)

  if (addr.includes('.')) {
    if (isNaN(len) || len < 0 || len > 32) return 'Prefixlängd måste vara 0–32'
    const parts = addr.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255))
      return 'Ogiltig IPv4-adress'
    const ip = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
    const mask = len === 0 ? 0 : ((~0) << (32 - len)) >>> 0
    const network = (ip & mask) >>> 0
    if (network !== ip) {
      const c = [(network >>> 24) & 0xff, (network >>> 16) & 0xff, (network >>> 8) & 0xff, network & 0xff].join('.')
      return `Hostbitar är satta — menade du ${c}/${len}?`
    }
    return ''
  }

  if (addr.includes(':')) {
    if (isNaN(len) || len < 0 || len > 128) return 'Prefixlängd måste vara 0–128'
    const full = expandIPv6(addr)
    if (!full) return 'Ogiltig IPv6-adress'
    const ipBits = BigInt('0x' + full.replace(/:/g, ''))
    const mask = len === 0 ? 0n : (~0n << BigInt(128 - len)) & ((1n << 128n) - 1n)
    const network = ipBits & mask
    if (network !== ipBits) {
      return `Hostbitar är satta — menade du ${formatIPv6(network)}/${len}?`
    }
    return ''
  }

  return 'Ogiltigt CIDR-format'
}
