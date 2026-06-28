# Security

If you discover a security vulnerability in `@seepine/openapi-generator`, please report it privately:

**Email:** seepine@duck.com

Please **do not** open a public GitHub issue for security reports. Public disclosure before a fix is available puts every user of the package at risk.

## What to include

- A description of the vulnerability and its impact
- Steps to reproduce, or a minimal OpenAPI document that triggers it
- The affected version(s)
- Any known mitigations or workarounds

## What to expect

- Acknowledgement within 72 hours
- A status update within 7 days
- A coordinated disclosure timeline once a fix is ready (typically 30–90 days, depending on severity and complexity)

## Scope

In scope: anything that lets the generator produce incorrect types, leak data between invocations, or execute unintended code at runtime.

Out of scope:

- Bugs in generated TypeScript that require a malformed OpenAPI document to trigger
- Issues in dependencies (`openapi-types`) — report those upstream
