# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Lock, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to the maintainers privately. You can reach us by opening a private security advisory on GitHub:

1. Go to the [Security tab](../../security) of this repository
2. Click "Report a vulnerability"
3. Fill in the details of the vulnerability

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation within 7 days for critical issues.

## Scope

The following are in scope for security reports:

- Authentication bypass or privilege escalation
- Cross-tenant data access (workspace isolation failures)
- SQL injection or other injection attacks
- Sensitive data exposure (API keys, tokens, credentials)
- Remote code execution

## Out of Scope

- The admin UI has been removed. If you find remnants of it, please report it.
- Denial of service via rate limiting exhaustion (we have rate limits, but they are configurable)
- Vulnerabilities in dependencies (please report these to the upstream project)

## Supported Versions

We provide security fixes for the latest release only.

| Version | Supported          |
| ------- | ------------------ |
| latest  | Yes                |
| < latest| No                 |
