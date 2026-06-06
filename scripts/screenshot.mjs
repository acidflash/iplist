import puppeteer from 'puppeteer'

const BASE = 'http://localhost:5173'
const OUT  = new URL('../docs/screenshots/', import.meta.url).pathname

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1440, height: 860 },
})

const page = await browser.newPage()

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${OUT}login.png` })
console.log('✓ login')

// Authenticate
await page.type('input[type="text"]', 'admin')
await page.type('input[type="password"]', 'admin')
await page.click('button[type="submit"]')
await page.waitForNavigation({ waitUntil: 'networkidle0' })

// Dashboard
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${OUT}dashboard.png` })
console.log('✓ dashboard')

// Prefixes
await page.goto(`${BASE}/prefixes`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${OUT}prefixes.png` })
console.log('✓ prefixes')

// Prefix detail — prefer a /16 for a good subnet calculator demo
const prefixHref = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a[href^="/prefixes/"]'))
  const link16 = links.find(a => a.textContent?.includes('/16'))
  const link8  = links.find(a => a.textContent?.includes('/8'))
  return (link16 || link8 || links[0])?.getAttribute('href') || null
})

await page.goto(`${BASE}${prefixHref}`, { waitUntil: 'networkidle0' })

// Trigger the subnet calculator: pick /24 (or fall back to option 3)
const calcSelect = await page.$('section select')
if (calcSelect) {
  const options = await page.$$eval('section select option', opts => opts.map(o => o.value))
  const target = options.includes('24') ? '24' : options[Math.min(3, options.length - 1)]
  await page.select('section select', target)
  await new Promise(r => setTimeout(r, 1500))
}

await page.screenshot({ path: `${OUT}prefix_detail.png` })
console.log('✓ prefix detail')

// Ping sweep — click "Pinga alla" and wait for results
const pingBtn = await page.evaluateHandle(() =>
  Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent?.includes('Pinga') || b.textContent?.includes('Ping')
  ) ?? null
)
const pingEl = pingBtn.asElement()
if (pingEl) {
  await pingEl.click()
  await new Promise(r => setTimeout(r, 4000))
  await page.screenshot({ path: `${OUT}ping.png` })
  console.log('✓ ping')
}

// VLANs
await page.goto(`${BASE}/vlans`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${OUT}vlans.png` })
console.log('✓ vlans')

// Import modal (open on VLANs page)
const importBtn = await page.evaluateHandle(() => {
  return Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent?.includes('Import') || b.textContent?.includes('Importera')
  ) ?? null
})
const el = importBtn.asElement()
if (el) {
  await el.click()
  await new Promise(r => setTimeout(r, 500))
  await page.screenshot({ path: `${OUT}import_modal.png` })
  console.log('✓ import modal')
  // Press Escape to close
  await page.keyboard.press('Escape')
  await new Promise(r => setTimeout(r, 200))
}

// Addresses
await page.goto(`${BASE}/addresses`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${OUT}addresses.png` })
console.log('✓ addresses')

// Users
await page.goto(`${BASE}/users`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${OUT}users.png` })
console.log('✓ users')

await browser.close()
console.log('\nAll screenshots saved to docs/screenshots/')
