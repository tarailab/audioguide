# Security review rubric

Review the changed code (and the surfaces it touches) for security problems.
This app is **publicly hosted**, so treat anything reachable from the internet as
hostile-input territory. Focus on real, exploitable issues over theoretical ones.

## Always check

### Secrets & config
- No API keys, tokens, passwords, or private keys committed in code, configs, or
  test files. (The automated `gitleaks` scan backs this up — but reason about
  whether anything *should* be a secret and isn't treated as one.)
- Secrets come from environment/secret store, not literals.
- `.env`, certs, and key material are git-ignored.

### Input handling (server)
- Every request body / query param is validated before use. Flag trusting client input.
- **Injection**: user input flowing into shell commands, file paths, SQL, or template
  strings without sanitisation. (This app shells out for media/TTS — scrutinise that.)
- **SSRF**: user-controlled values used to build outbound URLs/fetches.
- **Path traversal**: user input used in file reads/writes (`../`).

### Output handling (client)
- User/third-party content rendered as raw HTML (`dangerouslySetInnerHTML`) → XSS.
- URLs from data used directly in `href`/`src` without scheme checks.

### AuthN / AuthZ
- Endpoints that mutate or read user data check identity/authorisation — not just
  a client-supplied `x-user-id` header taken on trust.
- No security decisions made in client code that the server doesn't re-enforce.

### Transport & exposure
- No secrets or PII in URLs, logs, or error messages returned to the client.
- CORS isn't wildcard-open on endpoints that should be restricted.
- Verbose stack traces not leaked to users in production.

### Dependencies
- Note any dependency flagged by `npm audit` as high/critical, and whether the
  vulnerable path is actually reachable.

### Rate limiting / abuse / cost
- Endpoints that call paid APIs (Claude/OpenAI) or do expensive work: is there any
  abuse/rate protection? An open, unthrottled LLM endpoint is a money-drain risk.

## How to report
For each finding: **severity** (Critical / High / Medium / Low), the vulnerable
location, a one-line description of how it could be exploited, and the fix.
If you find nothing exploitable, say so explicitly and list what you checked —
don't pad with vague advice.
