# Accounts and sign-in

Two populations share one session mechanism:

- **Staff** — you, and anyone you promote. Run the site from the console.
- **Readers** — visitors who signed in to comment. No console access at all.

The whole design turns on keeping the second group out of the first group's
pages, so that part is described first.

---

## The role boundary

`UserRole` has three values. `ADMIN` and `EDITOR` are staff; `READER` is not.
The classification lives in exactly one place, `STAFF_ROLES` in
`src/lib/auth/guard.ts`, and everything else asks it:

| Guard | Admits | Used by |
| --- | --- | --- |
| `requireStaff(locale)` | ADMIN, EDITOR | The console layout and pages |
| `requireStaffForAction()` | ADMIN, EDITOR | Every console server action |
| `requireAdmin(locale)` | ADMIN | Account and key management |
| `requireReaderForAction()` | Any signed-in, unblocked account | Comment actions |

Three properties are worth stating explicitly, because each is easy to lose in
a later edit:

1. **Server actions check for themselves.** A server action is a public HTTP
   endpoint; anyone who learns its identifier can invoke it directly, and the
   console layout's check never runs. Every action calls a guard on its own
   first line.
2. **A reader is treated as a stranger, not as forbidden.** `requireStaff`
   redirects them to the console sign-in rather than showing a 403, because
   confirming that a page exists is itself information.
3. **The proxy is an optimisation.** `src/proxy.ts` checks only that a session
   *cookie* exists — the Edge runtime cannot reach the database. It saves
   rendering a page that is about to redirect. It is never the gate.

A test in `tests/auth-guard.test.ts` pins this down, including a check that
fails if a role is added to the enum without being classified.

### Promoting someone to staff

Deliberately not a button. Signing in never grants more than `READER`; to
promote an account, change the row:

```sql
UPDATE users SET role = 'EDITOR' WHERE email = 'someone@example.com';
```

---

## Reader sign-in

Readers sign in through OAuth. There is no reader password, no registration
form, and no email sending — which is the point: none of that infrastructure
has to exist or be secured.

### Configured providers

| Provider | Status | Notes |
| --- | --- | --- |
| GitHub | Supported | `https://github.com/settings/developers` → New OAuth App |
| Gitee (码云) | Supported | `https://gitee.com/oauth/applications` → 创建应用 |
| WeChat | **Not possible** | Website sign-in is issued only to corporate entities; individual developers cannot apply |
| QQ Connect | **Not possible today** | Requires an ICP-filed domain, and has effectively stopped accepting personal sites |

Set the callback URL to `<NEXT_PUBLIC_SITE_URL>/api/auth/<slug>/callback`, then
put the credentials in `.env`:

```bash
OAUTH_GITHUB_CLIENT_ID="..."
OAUTH_GITHUB_CLIENT_SECRET="..."
OAUTH_GITEE_CLIENT_ID="..."
OAUTH_GITEE_CLIENT_SECRET="..."
```

Each provider is independent. A provider missing either half of its credentials
is simply not offered on the sign-in page, so it can never fail halfway through
a redirect. With none configured, the site works exactly as before and the
sign-in page says so.

### The flow

```
/signin  →  /api/auth/github            mints a state nonce, sets a cookie
         →  github.com/login/oauth      the reader approves
         →  /api/auth/github/callback   verifies state, exchanges the code,
                                        reads the profile, links the account,
                                        issues a session
         →  back to where they started
```

Three details that are load-bearing:

- **State is verified before the code is exchanged.** A forged callback then
  costs the attacker a rejected request rather than a round trip to the
  provider on our credentials. Without state at all, an attacker could complete
  the dance in their own browser and feed the `code` to a victim, silently
  signing them into the *attacker's* account — and anything the victim wrote
  afterwards would land there.
- **The return path is restricted to this site.** `safeReturnPath` rejects
  absolute and protocol-relative URLs, so the sign-in link cannot be turned
  into an open redirect.
- **Access tokens are never stored.** They are used once, in the callback. The
  site never acts on a reader's behalf at the provider, so keeping one would be
  holding a credential with no purpose.

### Account linking

`src/lib/auth/oauth/link.ts` resolves a profile to a user in three steps:

1. The provider identity is already linked → sign that user in, and refresh the
   fields the provider owns (avatar, display name).
2. The **verified** email matches an existing account → link the new identity to
   it, so one person with GitHub *and* Gitee has one account, not two. This is
   also how your own credential account gains an OAuth login.
3. Otherwise → create a `READER`.

Step 2 is only safe because both providers hand over verified addresses only.
A provider added later that does not verify email **must not** participate in
matching, or someone could claim another person's account by registering their
address elsewhere. The list that controls this is
`PROVIDERS_WITH_VERIFIED_EMAIL`.

A reader whose provider withholds their address gets a synthetic one
(`github-12345@users.noreply.invalid`): unique, obviously not real, and not
deliverable, so nothing is ever accidentally sent to it.

### Adding a provider

Everything provider-specific is one object in `DEFINITIONS` in
`src/lib/auth/oauth/providers.ts`:

```ts
{
  id: 'LINUXDO',              // add to the AuthProvider enum first
  slug: 'linuxdo',
  label: 'LINUX DO',
  authorizeUrl: '…',
  tokenUrl: '…',
  scope: '…',
  fetchProfile: async (token) => ({ /* OAuthProfile */ }),
  clientId: env.OAUTH_LINUXDO_CLIENT_ID,
  clientSecret: env.OAUTH_LINUXDO_CLIENT_SECRET,
}
```

Plus two variables in `src/lib/env.ts` and `.env.example`. The routes, the
session code and the sign-in page need no changes.

---

## Sessions

Unchanged by any of this, and shared by both populations: a short JWT in an
HTTP-only cookie, paired with a row in `sessions` so it can be revoked before
it expires. Only a hash of the token id is stored.

The one addition is `blockedAt` on `User`. A blocked account can still sign in;
only its ability to post is withdrawn, and its existing comments are hidden.
Refusing the sign-in outright would make the block obvious and invite a second
account, which is a worse outcome than a quiet one.

---

## The owner's password login

`/{locale}/admin/login` is unchanged and still takes an email and a password.
It is the fallback that does not depend on a third party being reachable.

`passwordHash` is now nullable, because readers have none. A reader who somehow
reached the password form cannot use it: the comparison runs against a dummy
hash and fails, which is the same path as a wrong password and takes the same
time.
