/**
 * IPList translation interface.
 *
 * To add a new language:
 *   1. Copy en.ts to xx.ts  (xx = ISO 639-1 code, e.g. "de", "fr", "nl")
 *   2. Implement every key — TypeScript will error on any missing or mistyped keys
 *   3. Register it in index.tsx by adding an import and entry in the `langs` map
 *
 * Interpolated strings are typed as functions, e.g.:
 *   confirmDelete: (what: string) => `Delete ${what}?`
 */
export interface Translations {
  /** Display name shown in the language switcher, e.g. "Svenska", "English" */
  langName: string
  /** BCP 47 locale used for date formatting, e.g. "sv-SE", "en-US" */
  dateLocale: string

  common: {
    save: string
    cancel: string
    create: string
    add: string
    /** Label for "auto-detected" values */
    auto: string
    /** Label marking the currently logged-in user */
    you: string
    /** Generic form labels reused across pages */
    name: string
    description: string
    status: string
    loading: string
    somethingWentWrong: string
    confirmDelete: (what: string) => string
  }

  status: {
    active: string
    reserved: string
    deprecated: string
    pending: string
    /** "All statuses" option in filter dropdowns */
    all: string
  }

  nav: {
    dashboard: string
    prefixes: string
    vlans: string
    addresses: string
    users: string
    backup: string
    logout: string
    admin: string
    reader: string
  }

  login: {
    title: string
    subtitle: string
    username: string
    password: string
    submit: string
    submitting: string
    error: string
  }

  dashboard: {
    title: string
    ipAddresses: string
    utilization: string
    utilizationHint: string
    highUtil: string
    noHighUtil: string
    recent: string
    noRecent: string
    viewAll: string
  }

  prefixes: {
    title: string
    count: (n: number) => string
    searchPlaceholder: string
    colName: string
    colUtil: string
    colIPs: string
    emptySearch: string
    emptyAll: string
    modalCreate: string
    modalEdit: string
    cidr: string
    parentPrefix: string
    parentAuto: string
    confirmDelete: (cidr: string) => string
  }

  prefixDetail: {
    backTo: string

    // Network information panel
    netInfo: string
    networkAddr: string
    broadcast: string
    netmask: string
    wildcard: string
    firstHost: string
    lastHost: string
    usableHosts: string
    firstAddr: string
    lastAddr: string
    totalAddrs: string

    // Subnet calculator
    calculator: string
    splitInto: string
    calculate: string
    calculating: string
    subnetsCount: (n: string) => string
    subnetsShowing: (shown: number, total: string) => string
    hostsPerSubnet: (hosts: string) => string
    colSubnet: string
    colHosts: string
    colHostsUsable: string
    allocated: string
    free: string
    createSubnetTitle: (cidr: string) => string
    createSubnetBtn: string

    // Sections
    childPrefixes: string
    addresses: string
    addAddress: string
    noAddresses: string
    modalCreateAddr: (prefix: string) => string
    modalEditAddr: string
    ipAddress: string
    hostname: string
    dnsName: string
    namePlaceholder: string
    confirmDeleteAddr: (addr: string) => string

    // Header IP totals
    ipsTotal: string
    ipsUsed: string

    // Ping / discover
    pingAll: string
    pinging: string
    scanSubnet: string
    scanning: string
    discoverScanned: string
    discoverAddresses: string
    discoverResponded: string
    discoverAddedPending: string
    discoverPtrUpdated: string
    discoverErrors: (n: number) => string
    pingAlive: string
    pingDead: string
    pingUnknown: string
  }

  vlans: {
    title: string
    count: (n: number) => string
    searchPlaceholder: string
    colId: string
    colName: string
    colDesc: string
    emptySearch: string
    emptyAll: string
    modalCreate: string
    modalEdit: string
    vid: string
    vidHint: string
    confirmDelete: (vid: number) => string
  }

  addresses: {
    title: string
    count: (n: number) => string
    searchPlaceholder: string
    allPrefixes: string
    colIP: string
    colHostname: string
    colDNS: string
    colPrefix: string
    emptyFilter: string
    emptyAll: string
    modalCreate: string
    modalEdit: string
    ipAddress: string
    dnsName: string
    prefixAuto: string
    confirmDelete: (addr: string) => string
  }

  importCSV: {
    btn: string
    title: (what: string) => string
    dropzone: string
    format: string
    submit: string
    importing: string
    resultImported: (n: number) => string
    resultSkipped: (n: number) => string
    rowError: (row: number, err: string) => string
    downloadExample: string
    done: string
  }

  backup: {
    title: string
    downloadTitle: string
    /** Explains what the backup file contains */
    downloadDesc: string
    downloadBtn: string
    restoreTitle: string
    /** Warning that restore replaces ALL data */
    restoreDesc: string
    chooseFile: string
    restoreBtn: string
    restoring: string
    /** Native confirm() text shown before a restore is executed */
    confirmRestore: string
    restoredSummary: (vlans: number, prefixes: number, addresses: number, users: number) => string
  }

  users: {
    title: string
    count: (n: number) => string
    colUser: string
    colRole: string
    colCreated: string
    noUsers: string
    modalCreate: string
    modalEdit: (username: string) => string
    username: string
    password: string
    newPassword: string
    keepPassword: string
    role: string
    roleAdmin: string
    roleAdminDesc: string
    roleReader: string
    roleReaderDesc: string
    confirmDelete: (username: string) => string
    deleteError: string
  }
}
