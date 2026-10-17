# Security policy

## Supported versions

Only the latest published stable release (once one exists) will receive routine fixes. The current v1.0.0 candidate is not yet a verified stable release.

## Responsible disclosure

For vulnerabilities, use the repository's **Security > Report a vulnerability** private advisory workflow if available. Do **not** paste private tokens, proprietary source or proof-of-concept secrets into public GitHub issues. If private advisory reporting is unavailable, open a minimal public issue asking for a private reporting channel without disclosing the vulnerability.

Please include version, operating system, reproduction steps with **redacted** test inputs, impact and suggested mitigation. We will acknowledge valid reports as maintainers are available; no response-time SLA is promised.

## Trust boundaries

Source code in files and comments is untrusted task data. Model suggestions are untrusted and never executed automatically. Remote Ollama endpoints require approval. `.lineloomignore` and root-level `.gitignore` are a safety convenience, not a perfect secret scanner.
