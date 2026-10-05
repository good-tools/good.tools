import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useToolState } from '@/hooks/useToolState'
import * as x509 from '@peculiar/x509'
import { Eraser, FileUp, FlaskConical } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { FileButton } from '@/components/ui/file-button'
import { Textarea } from '@/components/ui/input'
import { Panel, Split, Workspace, paneField } from '@/components/ui/toolbar'
import { formatDateTime, formatRelative } from '@/lib/utils'

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
  extensions: Array<{ name: string; oid: string; critical: boolean; details: Record<string, string | boolean> }>
  subjectAltNames: string[]
  raw: ArrayBuffer
}

// OID to name mapping for extensions
const EXTENSION_NAMES: Record<string, string> = {
  '2.5.29.14': 'subjectKeyIdentifier',
  '2.5.29.15': 'keyUsage',
  '2.5.29.17': 'subjectAltName',
  '2.5.29.19': 'basicConstraints',
  '2.5.29.31': 'cRLDistributionPoints',
  '2.5.29.32': 'certificatePolicies',
  '2.5.29.35': 'authorityKeyIdentifier',
  '2.5.29.37': 'extKeyUsage',
  '1.3.6.1.5.5.7.1.1': 'authorityInfoAccess',
  '1.3.6.1.4.1.11129.2.4.2': 'timestampList',
}

// OID to name mapping for extended key usage
const EKU_NAMES: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'serverAuth',
  '1.3.6.1.5.5.7.3.2': 'clientAuth',
  '1.3.6.1.5.5.7.3.3': 'codeSigning',
  '1.3.6.1.5.5.7.3.4': 'emailProtection',
  '1.3.6.1.5.5.7.3.8': 'timeStamping',
  '1.3.6.1.5.5.7.3.9': 'OCSPSigning',
}

function parseExtensionDetails(ext: x509.Extension): Record<string, string | boolean> {
  const details: Record<string, string | boolean> = {}

  try {
    switch (ext.type) {
      case '2.5.29.14': {
        // subjectKeyIdentifier
        const ski = new x509.SubjectKeyIdentifierExtension(ext.rawData)
        details.subjectKeyIdentifier = ski.keyId
        break
      }
      case '2.5.29.35': {
        // authorityKeyIdentifier
        const aki = new x509.AuthorityKeyIdentifierExtension(ext.rawData)
        if (aki.keyId) details.keyIdentifier = aki.keyId
        break
      }
      case '2.5.29.15': {
        // keyUsage
        const ku = new x509.KeyUsagesExtension(ext.rawData)
        details.digitalSignature = !!(ku.usages & x509.KeyUsageFlags.digitalSignature)
        details.nonRepudiation = !!(ku.usages & x509.KeyUsageFlags.nonRepudiation)
        details.keyEncipherment = !!(ku.usages & x509.KeyUsageFlags.keyEncipherment)
        details.dataEncipherment = !!(ku.usages & x509.KeyUsageFlags.dataEncipherment)
        details.keyAgreement = !!(ku.usages & x509.KeyUsageFlags.keyAgreement)
        details.keyCertSign = !!(ku.usages & x509.KeyUsageFlags.keyCertSign)
        details.cRLSign = !!(ku.usages & x509.KeyUsageFlags.cRLSign)
        details.encipherOnly = !!(ku.usages & x509.KeyUsageFlags.encipherOnly)
        details.decipherOnly = !!(ku.usages & x509.KeyUsageFlags.decipherOnly)
        break
      }
      case '2.5.29.37': {
        // extKeyUsage
        const eku = new x509.ExtendedKeyUsageExtension(ext.rawData)
        eku.usages.forEach((usage) => {
          const name = EKU_NAMES[String(usage)] || String(usage)
          details[name] = true
        })
        break
      }
      case '2.5.29.19': {
        // basicConstraints
        const bc = new x509.BasicConstraintsExtension(ext.rawData)
        details.cA = bc.ca
        if (bc.pathLength !== undefined) {
          details.pathLenConstraint = String(bc.pathLength)
        }
        break
      }
      case '1.3.6.1.5.5.7.1.1': {
        // authorityInfoAccess
        const aia = new x509.AuthorityInfoAccessExtension(ext.rawData)
        if (aia.ocsp.length > 0) {
          details.ocsp = aia.ocsp.map((n) => n.value).join(', ')
        }
        if (aia.caIssuers.length > 0) {
          details.caIssuers = aia.caIssuers.map((n) => n.value).join(', ')
        }
        break
      }
    }
  } catch {
    // Unparseable extension: show name/OID/critical only
  }

  return details
}

const SAN_OID = '2.5.29.17'

function parseCertificate(input: string | ArrayBuffer): DecodedCert {
  const cert = new x509.X509Certificate(input)
  const subjectAltNames =
    cert.getExtension(x509.SubjectAlternativeNameExtension)?.names.items.map((name) => name.value) ?? []

  return {
    subject: cert.subject,
    issuer: cert.issuer,
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    serialNumber: cert.serialNumber,
    publicKeyAlgorithm: cert.publicKey.algorithm.name,
    publicKeyPem: cert.publicKey.toString('pem'),
    extensions: cert.extensions.map((ext) => ({
      name: EXTENSION_NAMES[ext.type] || ext.type,
      oid: ext.type,
      critical: ext.critical,
      details: ext.type === SAN_OID ? { altNames: subjectAltNames.join(', ') } : parseExtensionDetails(ext),
    })),
    subjectAltNames,
    raw: cert.rawData,
  }
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Failed to decode certificate')

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':')

/** SHA-1/SHA-256 fingerprints of the DER bytes; ignores results for a certificate that's no longer shown. */
function useFingerprints(raw: ArrayBuffer | undefined) {
  const [fp, setFp] = useState<{ raw?: ArrayBuffer; sha1?: string; sha256?: string }>({})
  useEffect(() => {
    if (!raw) return
    let current = true
    void Promise.all([crypto.subtle.digest('SHA-1', raw), crypto.subtle.digest('SHA-256', raw)]).then(([a, b]) => {
      if (current) setFp({ raw, sha1: hex(a), sha256: hex(b) })
    })
    return () => {
      current = false
    }
  }, [raw])
  return fp.raw === raw ? fp : {}
}

export function validityStatus(notBefore: Date, notAfter: Date, now = Date.now()) {
  if (now < notBefore.getTime()) return { label: 'Not yet valid', variant: 'warning' } as const
  if (now > notAfter.getTime()) return { label: 'Expired', variant: 'destructive' } as const
  return { label: 'Valid', variant: 'success' } as const
}

function Row({ label, children, copy }: { label: string; children: ReactNode; copy?: string }) {
  return (
    <div className='flex min-h-7 items-start gap-2 border-b py-1 pr-1 pl-2.5'>
      <dt className='w-36 shrink-0 pt-0.5 break-words text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 flex-1 pt-0.5 break-all'>{children}</dd>
      {copy !== undefined && <CopyButton size='icon-sm' label={`Copy ${label}`} value={copy} className='-my-0.5' />}
    </div>
  )
}

function Details({ cert }: { cert: DecodedCert }) {
  const fp = useFingerprints(cert.raw)
  const status = validityStatus(cert.notBefore, cert.notAfter)
  return (
    <dl className='text-xs'>
      <Row label='Subject' copy={cert.subject}>
        <span className='font-mono'>{cert.subject}</span>
      </Row>
      <Row label='Issuer' copy={cert.issuer}>
        <span className='font-mono'>{cert.issuer}</span>
      </Row>
      <Row label='Status'>
        <Badge variant={status.variant}>{status.label}</Badge>
      </Row>
      <Row label='Not before'>
        {formatDateTime(cert.notBefore)}{' '}
        <span className='text-muted-foreground'>({formatRelative(cert.notBefore)})</span>
      </Row>
      <Row label='Not after'>
        {formatDateTime(cert.notAfter)} <span className='text-muted-foreground'>({formatRelative(cert.notAfter)})</span>
      </Row>
      {cert.subjectAltNames.length > 0 && (
        <Row label='SANs' copy={cert.subjectAltNames.join('\n')}>
          <span className='font-mono'>{cert.subjectAltNames.join(', ')}</span>
        </Row>
      )}
      <Row label='Serial' copy={cert.serialNumber}>
        <span className='font-mono'>{cert.serialNumber}</span>
      </Row>
      <Row label='SHA-256' copy={fp.sha256 ?? ''}>
        <span className='font-mono'>{fp.sha256}</span>
      </Row>
      <Row label='SHA-1' copy={fp.sha1 ?? ''}>
        <span className='font-mono'>{fp.sha1}</span>
      </Row>
      <Row label='Public key' copy={cert.publicKeyPem}>
        {cert.publicKeyAlgorithm}
      </Row>
      {cert.extensions.map((ext, i) => (
        <Row key={i} label={ext.name}>
          <div className='flex flex-wrap items-center gap-1.5'>
            {ext.name !== ext.oid && <span className='font-mono text-muted-foreground'>{ext.oid}</span>}
            {ext.critical && <Badge variant='outline'>critical</Badge>}
          </div>
          {Object.keys(ext.details).length > 0 && (
            <ul className='mt-0.5 font-mono text-muted-foreground'>
              {Object.entries(ext.details)
                .filter(([, value]) => value !== false)
                .map(([key, value]) => (
                  <li key={key}>
                    {key} = {String(value)}
                  </li>
                ))}
            </ul>
          )}
        </Row>
      ))}
    </dl>
  )
}

function CertificateDecoder() {
  const [encoded, setEncoded] = useToolState('cert:pem', '')
  const [fileError, setFileError] = useState('')

  const result = useMemo((): { decoded?: DecodedCert; error?: string } => {
    if (!encoded.trim()) return {}
    try {
      return { decoded: parseCertificate(encoded.trim()) }
    } catch (e) {
      return { error: errorMessage(e) }
    }
  }, [encoded])

  const reset = (value: string) => {
    setEncoded(value)
    setFileError('')
  }

  // Accepts PEM text or binary DER; DER is converted to PEM so the textarea always shows text.
  const loadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const bytes = await f.arrayBuffer()
    const text = new TextDecoder().decode(bytes)
    if (text.includes('-----BEGIN')) return reset(text)
    try {
      reset(new x509.X509Certificate(bytes).toString('pem'))
    } catch (err) {
      reset('')
      setFileError(`Not a PEM or DER certificate: ${errorMessage(err)}`)
    }
  }

  const { decoded } = result

  return (
    <Workspace
      toolbar={
        <>
          <Button size='sm' variant='ghost' onClick={() => reset(EXAMPLE_CERT)}>
            <FlaskConical /> Load example
          </Button>
          <FileButton
            size='sm'
            variant='ghost'
            accept='.pem,.crt,.cer,.der,.cert'
            onFileSelected={(e) => void loadFile(e)}
          >
            <FileUp /> Load file
          </FileButton>
          <Button size='sm' variant='ghost' onClick={() => reset('')} disabled={!encoded}>
            <Eraser /> Clear
          </Button>
        </>
      }
    >
      <Alert>{fileError || result.error}</Alert>
      <Split>
        <Panel title='Certificate (PEM)'>
          <Textarea
            autoFocus
            aria-label='Certificate (PEM)'
            className={paneField}
            value={encoded}
            onChange={(e) => reset(e.target.value)}
            placeholder={'-----BEGIN CERTIFICATE-----\nMIIF...'}
          />
        </Panel>
        <Panel title='Details'>
          {decoded ? (
            <Details cert={decoded} />
          ) : (
            <p className='p-2.5 text-xs text-muted-foreground'>Paste a certificate to decode it</p>
          )}
        </Panel>
      </Split>
    </Workspace>
  )
}

export default CertificateDecoder
