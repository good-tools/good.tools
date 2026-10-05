/** The Whisper tiny revision this site serves (see src/whisper-assets.ts). Its files live in a
 * revision-scoped folder so a new model gets new URLs: the service worker caches /whisper/ cache-first. */
export const TINY_REVISION = 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7'
export const TINY_PATH = `/whisper/tiny/${TINY_REVISION.slice(0, 8)}`
