import * as x509 from '@peculiar/x509'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CertificateDecoder, { validityStatus } from './CertificateDecoder'

const RSA_CERT = `-----BEGIN CERTIFICATE-----
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

const ED25519_CERT = `-----BEGIN CERTIFICATE-----
MIIBKTCB3KADAgECAhEA9I9+eCQ+zYNPxzW9nxPlMTAFBgMrZXAwEDEOMAwGA1UE
ChMFdGFsb3MwHhcNMjUwMTEyMTYzMjAyWhcNMjYwMTEyMTYzMjAyWjATMREwDwYD
VQQKEwhvczphZG1pbjAqMAUGAytlcAMhAAdeAV/uQQBjdWWdcaYnfsiyfPB//MoP
JQ2I+fz4LCSJo0gwRjAOBgNVHQ8BAf8EBAMCB4AwEwYDVR0lBAwwCgYIKwYBBQUH
AwIwHwYDVR0jBBgwFoAUaMKDnlLRXRuu1HJz4Ei0ksEj+tQwBQYDK2VwA0EAyCoi
LsTiaGzVJlVVK2QZiqLrJCdPmhNfZ6Kj65nos2byRyGA2yNjTIPhV+MiAcKDKCsS
1FZXXO5Fvt8DlJCIAA==
-----END CERTIFICATE-----`

describe('CertificateDecoder', () => {
  describe('X509 Certificate Parsing', () => {
    it('should parse RSA certificate', () => {
      const cert = new x509.X509Certificate(RSA_CERT)

      expect(cert.subject).toContain('good.tools')
      expect(cert.publicKey.algorithm.name).toBe('RSASSA-PKCS1-v1_5')

      expect(cert.publicKey.toString('pem')).toContain('-----BEGIN PUBLIC KEY-----')
    })

    it('should parse Ed25519 certificate', () => {
      const cert = new x509.X509Certificate(ED25519_CERT)

      expect(cert.subject).toContain('os:admin')
      expect(cert.publicKey.algorithm.name).toBe('Ed25519')

      expect(cert.publicKey.toString('pem')).toContain('-----BEGIN PUBLIC KEY-----')
    })

    it('should extract public key PEM from Ed25519 certificate', () => {
      const cert = new x509.X509Certificate(ED25519_CERT)

      const publicKeyPem = cert.publicKey.toString('pem')

      expect(publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----')
      expect(publicKeyPem).toContain('-----END PUBLIC KEY-----')
    })

    it('should handle certificate serial number', () => {
      const rsaCert = new x509.X509Certificate(RSA_CERT)
      const ed25519Cert = new x509.X509Certificate(ED25519_CERT)

      expect(rsaCert.serialNumber).toBeTruthy()
      expect(ed25519Cert.serialNumber).toBeTruthy()
    })

    it('should parse validity dates', () => {
      const cert = new x509.X509Certificate(ED25519_CERT)

      expect(cert.notBefore).toBeInstanceOf(Date)
      expect(cert.notAfter).toBeInstanceOf(Date)
      expect(cert.notAfter.getTime()).toBeGreaterThan(cert.notBefore.getTime())
    })
  })

  describe('validityStatus', () => {
    const from = new Date('2024-01-01'),
      to = new Date('2025-01-01')
    it.each([
      [Date.parse('2023-06-01'), 'Not yet valid'],
      [Date.parse('2024-06-01'), 'Valid'],
      [Date.parse('2025-06-01'), 'Expired'],
    ])('at %s is %s', (now, label) => expect(validityStatus(from, to, now).label).toBe(label))
  })

  describe('component', () => {
    const upload = async (file: File) => {
      const user = userEvent.setup()
      const { container } = render(<CertificateDecoder />)
      await user.upload(container.querySelector<HTMLInputElement>('input[type=file]')!, file)
      return user
    }

    it('loads a binary DER file and decodes it live, with SANs and fingerprints', async () => {
      const der = new x509.X509Certificate(RSA_CERT).rawData
      await upload(new File([der], 'cert.der'))
      await waitFor(() => expect(screen.getByLabelText(/certificate/i)).toHaveDisplayValue(/BEGIN CERTIFICATE/))
      expect(screen.getByText('good.tools, *.good.tools')).toBeInTheDocument()
      expect(screen.getByText('altNames = good.tools, *.good.tools')).toBeInTheDocument()
      expect(screen.getByText('Expired')).toBeInTheDocument()
      expect(await screen.findByText(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)).toBeInTheDocument()
    })

    it('loads a PEM file as text', async () => {
      await upload(new File([ED25519_CERT], 'cert.pem'))
      await waitFor(() => expect(screen.getByLabelText(/certificate/i)).toHaveValue(ED25519_CERT))
      expect(screen.getByText('Ed25519')).toBeInTheDocument()
    })

    it('shows an alert for invalid input', async () => {
      const user = userEvent.setup()
      render(<CertificateDecoder />)
      await user.type(screen.getByLabelText(/certificate/i), 'garbage')
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
