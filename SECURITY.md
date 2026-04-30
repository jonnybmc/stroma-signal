# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Signal, please report it responsibly.

**Do not open a public issue.**

Instead, email **security@stroma.design** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 7 days.

## Scope

This package runs in the browser and collects performance data. It does not handle authentication, PII, or sensitive user data by design. However, we take any security concern seriously, including:

- XSS vectors in report URL encoding/decoding
- Data exfiltration through sink misconfiguration
- Supply chain integrity of published artifacts
