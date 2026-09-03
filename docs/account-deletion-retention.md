# Account deletion retention policy

Policy version: `account-deletion-v1`

Account deletion permanently removes sign-in identity and personal account data. A minimal deleted-user tombstone remains so public-safety records keep stable foreign keys and evidentiary history. The tombstone contains no email, phone, password, social identity, profile, or active device/session binding.

| Data type | Ownership | Action | Reason | Retention period | Foreign-key impact |
| --- | --- | --- | --- | --- | --- |
| User credentials and auth identities | User | Delete | Prevent future authentication and account recovery | Immediate | User tombstone remains with `Deleted` status |
| Refresh sessions and push tokens | User/device | Delete | Revoke every device and notification route | Immediate | No retained dependency |
| Profile, avatar, KYC, emergency contacts | User | Delete | Direct personal and identity data | Immediate | Profile-dependent displays fall back to Anonymous/Deleted account |
| Saved vehicles and vehicle photos | User | Delete | Private convenience data, not incident evidence | Immediate | Published stolen-vehicle evidence remains separately retained |
| Smartwatch pairing and latest device location | User/device | Anonymize and disconnect | Prevent biometric/device/session restoration and precise tracking | Immediate | Hardware inventory may remain without user binding |
| Community membership, presence, reads, reactions | User | Delete | Private participation state and derived activity | Immediate | Authored public-safety content is retained separately |
| Notifications and delivery state | System/user | Anonymize | Remove personal inbox ownership while preserving delivery diagnostics | Operational security retention | `userId` is cleared |
| Incident reports, emergency evidence, voice/video, sightings | Public safety | Retain and anonymize identity | Evidence integrity, responder operations, fraud prevention, and legal obligations | Per incident/evidence policy | Reporter/uploader points only to the non-identifying tombstone |
| Broadcasts, comments, Neighborhood Watch and community messages | Shared safety content | Retain and anonymize identity | Conversation integrity, abuse investigation, and public-safety continuity | Per moderation/content policy | Author points only to the non-identifying tombstone |
| SOS, patrol, moderation, support, and security records | Safety/security | Retain and anonymize identity | Safety investigation, abuse prevention, and legal obligations | Per applicable safety/security policy | User reference resolves to the tombstone, not personal profile data |
| Audit and admin action history | Security/legal | Retain | Tamper-evident accountability | Per audit policy | Actor reference resolves to the tombstone |

Deletion is distinct from deactivation. Deactivation retains account data and may be reversed by authorized policy; deletion removes credentials and personal data and cannot be reversed through sign-in, refresh, device pairing, or biometric unlock.
