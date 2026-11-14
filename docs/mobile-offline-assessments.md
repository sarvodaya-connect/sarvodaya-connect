# Offline rapid assessments on the phone

Issue #125 brings back the offline queue from PR #53, rebuilt for the V5 disaster screens and the signed-in API.

## What happens when an assessment is sent

1. **Saved first.** "Send assessment" saves the answers and any photos on the phone before trying to send.
2. **Sent.** The phone sends the assessment, then each photo. An item is removed from the phone only after the API confirms the assessment and every photo.
3. **Kept when it can't be sent.** The screen says "Saved on This Phone" or "Saved, but It Can't Be Sent Yet", with the reason. It never says "Assessment Sent" until the API has it.

## When it is retried

Retries happen only while the app is open:

- when the assessment is sent;
- when Disaster Response, an incident or the home's incident card opens or is refreshed;
- when the user taps **Retry sending** on the "saved on this phone" card.

Nothing is sent in the background after the app is closed.

## What each answer from the server does

| Answer | Shown as | What happens |
|---|---|---|
| No connection | Waiting for a connection | Kept; retried later |
| Server error (5xx) | The server did not answer | Kept; retried later |
| 401 | Sign in again to send it | Kept; sent after signing in |
| 403 or 404 | You can no longer send this for this society… | Kept as blocked; the user can retry or remove it |
| 409 "closed" | The incident was closed before this arrived | Kept as blocked |
| Other 4xx | The server did not accept it, with its reason | Kept as blocked |
| A saved photo can't be read on the phone (damaged, or fails decryption) | A saved photo can't be read on this phone… | Only that item is kept as blocked; the rest of the queue is still sent |

"Remove from this phone" is on every saved item, whether it is waiting or blocked, and is turned off while a round of sending runs. It asks first, then deletes the answers and photos. The API checks permissions, the incident's state and temporary access again on every attempt.

## Duplicates

- **Assessments:** each assessment keeps one `clientMutationId` for every retry. The API stores one assessment per user and id.
  - A retry, even after a lost response, returns the same assessment with `replayed: true`.
  - Two copies of the same send arriving together are also confirmed: the one that loses the race reads back the assessment the other recorded, instead of failing with a database error.
  - The repeat is checked before the incident's state and the user's current access, so an assessment already received is confirmed even if the incident has since closed or the user lost access. A new assessment in that situation is still refused.
- **Photos:** a photo whose upload was cut off is uploaded again on the next try.
  - The retry reuses the unfinished upload record for the same file (same uploader, assessment, type, size and SHA-256), with a new upload link. Retries therefore never use up the 10-photo limit.
  - If the confirmation of a finished upload is lost, the retry creates a second record for the same photo. The endpoint has no mutation id to prevent this.

## Where the data is kept

- **Folder:** each account has its own folder in the app's private support directory (`assessment-queue/<hash of the account id>`).
- **Encryption:** the queue and each photo are encrypted with AES-256-GCM. Each account's key is in the iOS Keychain or the Android Keystore-backed secure storage (`flutter_secure_storage`). The key is created once per account, even when several photos are saved at the same moment.
- **Other accounts:** another account on the same phone reads only its own folder. It cannot decrypt anyone else's files.
- **Sign-out:** the saved items stay encrypted on the phone so the same person can send them after signing in again. Nothing of them is kept in memory.
  - Sending stops as soon as the account that saved an item signs out, including in the middle of a photo upload. Each request is checked just before it leaves, so nothing is ever sent with the next account's sign-in.
  - A 401 during a send marks the item "Sign in again" and keeps every other saved item.
- **One change at a time:** saving, sending progress and removing all update the queue in turn, each starting from the latest queue, so none of them overwrites another.
- **Unreadable queue:** if the queue cannot be read, it is never written over.
  - The next save sets the old file aside (`queue.set-aside-*.bin`) and starts a new queue.
  - Each time the queue loads, set-aside items are added back if they can be read again, for example after a passing storage error.
  - If the key is lost for good (for example after a reinstall or a restore to another phone), the old file stays aside, unread.
- **Demonstration mode:** the queue is kept in memory only.

## Device check

Use fictional data and a local or TEST API.

1. Sign in as a Society Officer, SPC or DDM who covers a society in a live incident.
2. Turn on airplane mode. Complete a rapid assessment, with a photo, and tap **Send assessment**. Expect "Saved on This Phone".
3. Close the app completely and open it again. Sign in once the connection is back; airplane mode can stay on until step 4. Open Disaster Response and expect "1 assessment saved on this phone".
4. Turn off airplane mode and tap **Retry sending**. Expect "1 saved assessment sent." Check the incident shows one new update with its photo.
5. Tap **Retry sending** again, or pull to refresh. No second update appears.
6. Sign out and sign in as someone else. The saved card is not shown.
7. Close the incident from another account, then send a new assessment offline and retry online. Expect "The incident was closed before this arrived". The item stays until you remove it.

The pull request for issue #125 records the simulator check that was run.
