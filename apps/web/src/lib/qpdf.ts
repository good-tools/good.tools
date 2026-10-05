import createQpdf from '@neslinesli93/qpdf-wasm'
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'
import { PasswordError } from '@/lib/pdf'

interface Qpdf {
  callMain(args: string[]): number
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array }
}

/** Runs `qpdf --password=… <args> in.pdf out.pdf` on a fresh instance (clean FS, no state between calls). */
async function qpdf(input: Uint8Array, password: string, args: string[]): Promise<Uint8Array> {
  // This build ignores `printErr` and binds console.error when the instance is created (synchronously,
  // inside this call), so a stand-in installed just around it receives qpdf's error messages
  const errors: string[] = []
  const consoleError = console.error
  console.error = (...line: unknown[]) => errors.push(line.join(' '))
  const ready = (createQpdf as unknown as (o: object) => Promise<Qpdf>)({ locateFile: () => wasmUrl })
  console.error = consoleError
  const q = await ready

  q.FS.writeFile('/in.pdf', input)
  const rc = q.callMain([`--password=${password}`, ...args, '/in.pdf', '/out.pdf'])
  if (errors.some((e) => e.includes('invalid password')))
    throw new PasswordError(password ? 'Wrong password' : 'This PDF is password-protected')
  // 3 = done, with warnings
  if (rc !== 0 && rc !== 3)
    throw new Error(errors.map((e) => e.replace(/^.*?\/in\.pdf: /, '')).join('\n') || `qpdf failed (exit ${rc})`)
  return q.FS.readFile('/out.pdf')
}

export interface ProtectOptions {
  userPassword: string
  /**
   * Lifts the restrictions. Opening with an owner password grants every permission, so it defaults to the
   * user password only when nothing is restricted; otherwise to a random one nobody knows.
   */
  ownerPassword?: string
  printing: boolean
  copying: boolean
  modifying: boolean
}

/** AES-256 encrypts a PDF. */
export const protectPdf = (bytes: Uint8Array, o: ProtectOptions) =>
  qpdf(bytes, '', [
    '--encrypt',
    `--user-password=${o.userPassword}`,
    `--owner-password=${o.ownerPassword || (o.printing && o.copying && o.modifying ? o.userPassword : crypto.randomUUID())}`,
    '--bits=256',
    `--print=${o.printing ? 'full' : 'none'}`,
    `--extract=${o.copying ? 'y' : 'n'}`,
    `--modify=${o.modifying ? 'all' : 'none'}`,
    '--',
  ])

/** Removes the open password and all restrictions. */
export const unlockPdf = (bytes: Uint8Array, password: string) => qpdf(bytes, password, ['--decrypt'])
