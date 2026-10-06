// Each library is imported on first use of its language or mode, so the tool chunk stays small.

export const LANGUAGES = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
} as const
export type Language = keyof typeof LANGUAGES
export type Indent = '2' | '4' | 'tab'

export const SQL_DIALECTS = {
  sql: 'Standard SQL',
  bigquery: 'BigQuery',
  db2: 'Db2',
  hive: 'Hive',
  mariadb: 'MariaDB',
  mysql: 'MySQL',
  plsql: 'Oracle PL/SQL',
  postgresql: 'PostgreSQL',
  redshift: 'Redshift',
  snowflake: 'Snowflake',
  spark: 'Spark',
  sqlite: 'SQLite',
  transactsql: 'SQL Server',
  trino: 'Trino',
} as const
export type SqlDialect = keyof typeof SQL_DIALECTS

/** Minifiers exist for these; TypeScript, SCSS and SQL can only be beautified. */
export const canMinify = (lang: Language) => lang === 'javascript' || lang === 'css' || lang === 'html'

export class CodeError extends Error {
  constructor(
    message: string,
    readonly line?: number,
    readonly column?: number,
  ) {
    super(message)
  }
}

type Loc = { line?: number; column?: number; col?: number; loc?: { start?: { line: number; column: number } } }

/** Normalise the libraries' error shapes to a message plus a 1-based position. */
function toCodeError(e: unknown): CodeError {
  const err = (e ?? {}) as Loc & { message?: string }
  // Prettier appends a code frame after the first line; the editor shows the code
  let message = String(err.message ?? e).split('\n')[0] ?? ''
  let line = err.loc?.start?.line ?? err.line
  // Terser's col is 0-based
  let column = err.loc?.start?.column ?? (err.col != null ? err.col + 1 : err.column)
  const sql = /at line (\d+) column (\d+)/.exec(message) // sql-formatter
  if (sql) [line, column] = [Number(sql[1]), Number(sql[2])]
  message = message.replace(/\s*\(\d+:\d+\)$/, '')
  return new CodeError(message, line, column)
}

async function prettier(code: string, lang: Exclude<Language, 'sql'>, indent: Indent) {
  const [{ format }, ...plugins] = await Promise.all([
    import('prettier/standalone'),
    ...(lang === 'css' || lang === 'scss'
      ? [import('prettier/plugins/postcss')]
      : lang === 'html'
        ? // HTML formats its <script> and <style> blocks too
          [
            import('prettier/plugins/html'),
            import('prettier/plugins/postcss'),
            import('prettier/plugins/babel'),
            import('prettier/plugins/estree'),
          ]
        : // babel-ts handles TypeScript without the 200 kB typescript plugin
          [import('prettier/plugins/babel'), import('prettier/plugins/estree')]),
  ])
  const parser = { javascript: 'babel', typescript: 'babel-ts', html: 'html', css: 'css', scss: 'scss' }[lang]
  return format(code, {
    parser,
    plugins,
    useTabs: indent === 'tab',
    tabWidth: indent === '4' ? 4 : 2,
    printWidth: 100,
  })
}

export async function beautify(code: string, lang: Language, indent: Indent, dialect: SqlDialect = 'sql') {
  try {
    if (lang !== 'sql') return await prettier(code, lang, indent)
    const { format } = await import('sql-formatter')
    return `${format(code, {
      language: dialect,
      useTabs: indent === 'tab',
      tabWidth: indent === '4' ? 4 : 2,
      keywordCase: 'upper',
    })}\n`
  } catch (e) {
    throw toCodeError(e)
  }
}

export async function minify(code: string, lang: Language) {
  try {
    if (lang === 'javascript') {
      const { minify } = await import('terser')
      return (await minify(code)).code ?? ''
    }
    if (lang === 'css') {
      const { minify } = await import('csso')
      return minify(code).css
    }
    if (lang === 'html') {
      const [{ minify }, csso] = await Promise.all([import('html-minifier-terser'), import('csso')])
      return await minify(code, {
        collapseWhitespace: true,
        removeComments: true,
        // csso instead of its default clean-css, which needs Node's path module
        minifyCSS: (css: string, type?: string) =>
          type === 'inline' ? csso.minifyBlock(css).css : type === 'media' ? css : csso.minify(css).css,
        minifyJS: true,
        decodeEntities: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
      })
    }
  } catch (e) {
    throw toCodeError(e)
  }
  throw new CodeError(`Minifying ${LANGUAGES[lang]} is not supported`)
}

export const EXAMPLES: Record<Language, string> = {
  javascript: `// Fetch a user and greet them
async function greet(id){const res=await fetch(\`/api/users/\${id}\`);if(!res.ok){throw new Error('HTTP '+res.status)}
const {name,roles=[]}=await res.json();return roles.includes('admin')?\`Welcome back, \${name} (admin)\`:\`Hello, \${name}!\`}
export default greet`,
  typescript: `interface User{id:number;name:string;roles?:string[]}
export function isAdmin<T extends User>(user:T):boolean{return user.roles?.includes('admin')??false}
const users:User[]=[{id:1,name:'Ada',roles:['admin']},{id:2,name:'Linus'}];console.log(users.filter(isAdmin).map(u=>u.name))`,
  html: `<!DOCTYPE html><html><head><title>Example</title><style>body{font-family:sans-serif;margin:0}</style></head>
<body><!-- navigation --><nav class="top"><a href="/">Home</a> <a href="/about">About</a></nav><main><h1>Hello</h1><p>Some <b>bold</b> text.</p></main>
<script>document.querySelector('h1').addEventListener('click',function(){alert('hi')})</script></body></html>`,
  css: `/* Buttons */
.btn{display:inline-flex;align-items:center;padding:4px 12px;border-radius:6px;background-color:#ffffff;color:#000000}
.btn:hover,.btn:focus-visible{background-color:#f5f5f5}@media (max-width:600px){.btn{padding:2px 8px;margin:0px 0px 0px 0px}}`,
  scss: `$radius:6px;
.card{border-radius:$radius;padding:8px;&:hover{box-shadow:0 1px 2px rgba(0,0,0,.1)}.title{font-weight:600;@media (max-width:600px){font-size:14px}}}`,
  sql: `select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.created_at>='2024-01-01' and u.active=true group by u.id,u.name having count(o.id)>5 order by orders desc limit 10;`,
}
