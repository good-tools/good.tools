import { useEffect, useRef, useState } from 'react'
import * as x509 from '@peculiar/x509'
import moment from 'moment'
import { CodeGroup } from '@/components/Code'
import { Button } from '@/components/ui/button'
import TextArea from '@/components/TextArea'
import { cn } from '@/lib/utils'
import FileButton from '@/components/FileButton'

const EXAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIFzjCCBLagAwIBAgIQCAID3TIok1it+qMlOD7pcTANBgkqhkiG9w0BAQsFADA8
MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRwwGgYDVQQDExNBbWF6b24g
UlNBIDIwNDggTTAyMB4XDTIyMTIxNjAwMDAwMFoXDTI0MDExNDIzNTk1OVowFTET
MBEGA1UEAxMKZ29vZC50b29sczCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBANe0t96ql19cOVP/fqhqrG6U66hGl8yF+CBX9Scx3wGkD4qtHTmC3uOqbcT1
9Vc+GGEL0joPboBEiPTqID2trlVxwBe59UZukfUs7ZZfpyWBEpHMEEc+WS7f5s+b
ZT1sOyCgBV0/qllQnQPDF79ckWXCj33Q6Wi51eOoVBrHbp98KCs3tFzel57Sn8aQ
qTX9qCxeLiKoJLWK+lqx7eOUX6VgoYEdmiO8n0WgXIgffAxvS6uukjiY3hdOXrmq
VfH6KdSFSt97nFRoAMiQCc+Chu1wDva/XXsk2b8JQslO6yKPB6KDbuZIKRTEP5eM
22lZsYJW+ufRoPKGVEOzipu8jRsCAwEAAaOCAvEwggLtMB8GA1UdIwQYMBaAFMAx
Us1aUMOCfHRxzsvpnPl664LiMB0GA1UdDgQWBBR1ZHMqohcG+azPAT97VNyiCltN
lTAjBgNVHREEHDAaggpnb29kLnRvb2xzggwqLmdvb2QudG9vbHMwDgYDVR0PAQH/
BAQDAgWgMB0GA1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjA7BgNVHR8ENDAy
MDCgLqAshipodHRwOi8vY3JsLnIybTAyLmFtYXpvbnRydXN0LmNvbS9yMm0wMi5j
cmwwEwYDVR0gBAwwCjAIBgZngQwBAgEwdQYIKwYBBQUHAQEEaTBnMC0GCCsGAQUF
BzABhiFodHRwOi8vb2NzcC5yMm0wMi5hbWF6b250cnVzdC5jb20wNgYIKwYBBQUH
MAKGKmh0dHA6Ly9jcnQucjJtMDIuYW1hem9udHJ1c3QuY29tL3IybTAyLmNlcjAM
BgNVHRMBAf8EAjAAMIIBfgYKKwYBBAHWeQIEAgSCAW4EggFqAWgAdwDuzdBk1dsa
zsVct520zROiModGfLzs3sNRSFlGcR+1mwAAAYUcWfxKAAAEAwBIMEYCIQCJHdV1
TycoNjhL2y8OHxixJGiQc+ssiLt53Z/zWhmKUgIhALhWnYHlXt+Tf0vAKxRSfcZf
dxcahQsEqm/jTKSnigNVAHUAc9meiRtMlnigIH1HneayxhzQUV5xGSqMa4AQesF3
crUAAAGFHFn8sQAABAMARjBEAiBmMG+ZdPgzdfjbM4QGy0/ASsgNQ9RS7A6Y0yOz
ATnwdgIgXvQjpGWid/DKm/ARPlMF1IGjWV7sZNvb872eAdbFq7oAdgBIsONr2qZH
NA/lagL6nTDrHFIBy1bdLIHZu7+rOdiEcwAAAYUcWfxjAAAEAwBHMEUCIAmIjE5A
mj1wDtutyUqcB1XhjkSKGc7YUwRsRZt7RsHzAiEAxHNTkkHVdKGz2ovdOJ/uP532
1PduHSVxpZTTYIjF8WgwDQYJKoZIhvcNAQELBQADggEBADO9thRd7GhiU09/oY68
9fHrnPivbvyQrBtwKOtsqa2k+0qf6Zhc2URJziigAa61O2MrQDLMm6H4qZ70ZTPV
IzdQC0ezR9Kewd7TDp5TvrBDZsHhYpEg5xB82/9LGYNjaYg0EfEIS6QaJFRF6mNo
YBoh+bLsodofsWCIogvtpHZmDXK91JDcOr3rSKZtFwL6lg8cYdKXpZ5meDGT6HR6
4mDtz7sSwPid9n6KUz2plDAwMnYefX5RZoxJAvcB4wua5io6nymaKBtZPoF1rlil
7O6fCTlqFsWaoFeWrhvygP3ZaEu6r8P5n+x99UBJElfg3ybXZ5v29EyzMaDhUv0U
0m0=
-----END CERTIFICATE-----`

interface DecodedCert {
  subject: string
  issuer: string
  notBefore: Date
  notAfter: Date
  serialNumber: string
  publicKeyAlgorithm: string
  publicKeyPem: string
  extensions: Array<{ name: string; value: string }>
  subjectAltNames: string[]
}

function parseCertificate(pem: string): DecodedCert {
  const cert = new x509.X509Certificate(pem)

  // Get subject alt names
  const subjectAltNames: string[] = []
  const sanExt = cert.extensions.find((e) => e.type === '2.5.29.17') // subjectAltName OID
  if (sanExt) {
    const san = new x509.SubjectAlternativeNameExtension(sanExt.rawData)
    san.names.items.forEach((name) => {
      subjectAltNames.push(name.value)
    })
  }

  // Parse extensions
  const extensions = cert.extensions.map((ext) => {
    const names: Record<string, string> = {
      '2.5.29.14': 'subjectKeyIdentifier',
      '2.5.29.15': 'keyUsage',
      '2.5.29.17': 'subjectAltName',
      '2.5.29.19': 'basicConstraints',
      '2.5.29.31': 'cRLDistributionPoints',
      '2.5.29.32': 'certificatePolicies',
      '2.5.29.35': 'authorityKeyIdentifier',
      '2.5.29.37': 'extKeyUsage',
    }
    return {
      name: names[ext.type] || ext.type,
      value: ext.critical ? '(critical)' : '',
    }
  })

  return {
    subject: cert.subject,
    issuer: cert.issuer,
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    serialNumber: cert.serialNumber,
    publicKeyAlgorithm: cert.publicKey.algorithm.name,
    publicKeyPem: cert.publicKey.toString('pem'),
    extensions,
    subjectAltNames,
  }
}

function CertificateDecoder() {
  const [encoded, setEncoded] = useState('')
  const [decoded, setDecoded] = useState<DecodedCert | null>(null)
  const [error, setError] = useState<string | null>(null)
  const encodedRef = useRef<HTMLTextAreaElement>(null)

  const decode = () => {
    try {
      setError(null)
      const data = parseCertificate(encoded)
      setDecoded(data)
    } catch (err) {
      console.error('Failed to decode certificate:', err)
      setError(err instanceof Error ? err.message : 'Failed to decode certificate')
      setDecoded(null)
    }
  }

  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    const reader = new FileReader()
    reader.addEventListener('load', (event) => {
      setEncoded(event.target?.result as string)
      setDecoded(null)
      setError(null)
    })
    reader.readAsText(f)
  }

  const loadExample = () => {
    setEncoded(EXAMPLE_CERT)
    setDecoded(null)
    setError(null)
  }

  const clear = () => {
    setEncoded('')
    setDecoded(null)
    setError(null)
  }

  useEffect(() => {
    encodedRef.current?.focus()
  }, [])

  // Extract CN from subject for display
  const displayName = decoded
    ? decoded.subjectAltNames.length > 0
      ? decoded.subjectAltNames.join(', ')
      : decoded.subject
    : ''

  return (
    <div>
      <TextArea
        ref={encodedRef}
        id='encoded'
        name='encoded'
        rows={8}
        value={encoded}
        onCtrlEnter={() => decode()}
        onChange={(e) => setEncoded(e.target.value)}
        className='font-mono text-xs'
        placeholder={'Paste your PEM encoded certificate here'}
      />
      <div className='mt-3'>
        <Button onClick={() => decode()}>Decode</Button>
        <FileButton variant='ghost' className={'ml-5'} onFileSelected={loadFile}>
          Load File
        </FileButton>
        <Button variant='ghost' className={'ml-3'} onClick={loadExample}>
          Load Example
        </Button>
        <Button variant='ghost' className={'ml-3'} onClick={clear}>
          Clear
        </Button>
      </div>
      {error && (
        <div className='mt-3 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg'>{error}</div>
      )}
      {decoded !== null && (
        <div className='mt-3 overflow-hidden w-full dark:bg-zinc-800 shadow dark:shadow-zinc-900 sm:rounded-lg'>
          <div className='px-4 py-5 sm:px-6'>
            <h3 className='text-lg font-medium leading-6'>{displayName}</h3>
          </div>
          <div className='border-t border-gray-200 dark:border-zinc-700 px-4 py-5 sm:px-6'>
            <dl className='grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2'>
              <div className='sm:col-span-1'>
                <dt className='text-sm font-medium text-gray-500'>Subject</dt>
                <dd className='mt-1 text-sm'>{decoded.subject}</dd>
              </div>
              <div className='sm:col-span-1'>
                <dt className='text-sm font-medium text-gray-500'>Issuer</dt>
                <dd className='mt-1 text-sm'>{decoded.issuer}</dd>
              </div>
              <div className='sm:col-span-1'>
                <dt className='text-sm font-medium text-gray-500'>Valid From</dt>
                <dd className='mt-1 text-sm'>
                  {moment(decoded.notBefore).format('dddd, MMMM Do YYYY, h:mm:ss A')}
                  <div className={cn(moment(decoded.notBefore).isBefore(moment()) ? 'text-green-500' : 'text-red-500')}>
                    ({moment(decoded.notBefore).fromNow()})
                  </div>
                </dd>
              </div>
              <div className='sm:col-span-1'>
                <dt className='text-sm font-medium text-gray-500'>Valid To</dt>
                <dd className='mt-1 text-sm'>
                  {moment(decoded.notAfter).format('dddd, MMMM Do YYYY, h:mm:ss A')}
                  <div className={cn(moment(decoded.notAfter).isAfter(moment()) ? 'text-green-500' : 'text-red-500')}>
                    ({moment(decoded.notAfter).fromNow()})
                  </div>
                </dd>
              </div>
              <div className='sm:col-span-1'>
                <dt className='text-sm font-medium text-gray-500'>Serial</dt>
                <dd className='mt-1 text-sm'>{decoded.serialNumber}</dd>
              </div>
              <div className='sm:col-span-1'>
                <dt className='text-sm font-medium text-gray-500'>Extensions</dt>
                <dd className='mt-1 text-sm'>
                  {decoded.extensions.map((e, i) => (
                    <div key={`ex-${i}`}>
                      <span className='font-bold'>{e.name}</span>
                      {e.value && <span className='ml-2 text-gray-500'>{e.value}</span>}
                    </div>
                  ))}
                </dd>
              </div>
              <div className='sm:col-span-2'>
                <dt className='text-sm font-medium text-gray-500'>Public Key ({decoded.publicKeyAlgorithm})</dt>
                <dd className='mt-1 text-sm'>
                  <CodeGroup>
                    <code>{decoded.publicKeyPem}</code>
                  </CodeGroup>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificateDecoder
