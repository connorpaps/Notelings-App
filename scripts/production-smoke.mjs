#!/usr/bin/env node
import process from 'node:process'

function valueFor(flag, fallback) {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const baseUrl = valueFor('--url', '')
if (!baseUrl) throw new Error('Usage: node scripts/production-smoke.mjs --url https://deployment.example')
const origin = new URL(baseUrl).origin

const requiredHeaders = [
  'content-security-policy',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-frame-options',
]

const healthResponse = await fetch(new URL('/api/health', origin))
const healthBody = await healthResponse.json().catch(() => null)
if (!healthResponse.ok || healthBody?.status !== 'ok') {
  throw new Error(`Health check failed with HTTP ${healthResponse.status}`)
}

const pageResponse = await fetch(origin)
const headerPresence = Object.fromEntries(requiredHeaders.map((header) => [header, pageResponse.headers.has(header)]))
const missingHeaders = requiredHeaders.filter((header) => !headerPresence[header])
if (missingHeaders.length > 0) {
  throw new Error(`Missing required security headers: ${missingHeaders.join(', ')}`)
}

const contentSecurityPolicy = pageResponse.headers.get('content-security-policy') ?? ''
const wasmUnsafeEvalPresent = contentSecurityPolicy.includes("'wasm-unsafe-eval'")
if (!wasmUnsafeEvalPresent) throw new Error('Content-Security-Policy is missing wasm-unsafe-eval required by the GLB Meshopt decoder')

const isHttps = new URL(origin).protocol === 'https:'
const hstsPresent = pageResponse.headers.has('strict-transport-security')
if (isHttps && !hstsPresent) throw new Error('HTTPS deployment is missing Strict-Transport-Security')

console.log(JSON.stringify({
  origin,
  health: { status: healthBody.status, service: healthBody.service },
  healthCacheControl: healthResponse.headers.get('cache-control'),
  securityHeadersPresent: headerPresence,
  wasmUnsafeEvalPresent,
  hstsPresent,
  pageStatus: pageResponse.status,
}, null, 2))
