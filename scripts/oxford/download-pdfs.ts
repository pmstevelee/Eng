import * as fs from 'fs'
import * as https from 'https'
import * as path from 'path'
import * as http from 'http'

const PDFS = [
  {
    url: 'https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000_by_CEFR_level.pdf',
    filename: 'oxford-3000.pdf',
    label: 'Oxford 3000',
  },
  {
    url: 'https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf',
    filename: 'oxford-5000.pdf',
    label: 'Oxford 5000',
  },
]

const RAW_DIR = path.join(process.cwd(), 'scripts/oxford/raw')
const FORCE = process.argv.includes('--force')

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    let received = 0

    const request = (urlStr: string, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'))
      const mod: typeof https | typeof http = urlStr.startsWith('https') ? https : http
      mod.get(urlStr, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location!, redirects + 1)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`))
        }
        const total = parseInt(res.headers['content-length'] ?? '0', 10)
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          if (total > 0) {
            const pct = ((received / total) * 100).toFixed(1)
            process.stdout.write(`\r  ${pct}% (${(received / 1024).toFixed(0)} KB)   `)
          }
        })
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          process.stdout.write('\n')
          resolve()
        })
      }).on('error', reject)
    }

    request(url)
    file.on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true })

  for (const { url, filename, label } of PDFS) {
    const dest = path.join(RAW_DIR, filename)
    if (fs.existsSync(dest) && !FORCE) {
      console.log(`✓ ${label} 이미 존재: ${filename} (--force로 강제 다운로드)`)
      continue
    }
    console.log(`⬇  ${label} 다운로드 중...`)
    console.log(`   URL: ${url}`)
    try {
      await downloadFile(url, dest)
      const size = fs.statSync(dest).size
      console.log(`✓ 저장 완료: ${filename} (${(size / 1024).toFixed(0)} KB)`)
    } catch (err) {
      console.error(`✗ 실패: ${label}`, err)
      process.exit(1)
    }
  }
  console.log('\n모든 PDF 준비 완료.')
}

main()
