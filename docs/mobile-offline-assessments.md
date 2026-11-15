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

Sending never holds up a screen:
- Disaster Response, the incident page and the home's incident card load at the same time as saved assessments are sent, and reload once when something was sent.
- A photo upload that does not finish within 2 minutes counts as no connection, and the assessment is retried later.
- The "saved on this phone" card stays visible while a screen is loading and when it cannot load (for example offline), with each item's state, **Retry sending** and **Remove from this phone**.
  - The card and the loading or error content below it share one scrolling page. However many items are saved, and on a small phone with large text, every item, its **Remove** button, **Retry sending** and the content below can be scrolled to.
  - With few items the content fills the space under the card as before. Loading the screen never waits for sending.

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
- **Photos:** each saved photo has its own id (`clientUploadId`, a UUID), made when the assessment is saved and kept with the photo in the encrypted queue, so it survives the app being closed. Every retry of that photo sends the same id.
  - The API keeps one evidence record per uploader and id (a unique index on `uploaded_by_id, client_upload_id`).
  - **Upload cut off:** the retry gets a new upload link for the same record and storage key.
  - **Uploaded and completed, but the answer was lost:** the retry is confirmed with `evidence.uploaded: true` and `upload: null`. The phone marks the photo sent without uploading or completing it again, so the stored file is never replaced.
  - **Retries at the same moment** (a second tap, or two rounds): the unique index lets only one record be created; the other request resumes or confirms that record.
  - **Completing again** returns success for the uploader's own photo, instead of 409, without checking or touching storage.
  - **The 10-photo limit** counts records, and a retry never adds one. While a new photo is counted and recorded, its assessment (or delivery) is locked, so photos sent together cannot pass the limit. An actual eleventh photo is refused.
  - **Boundaries:** the lookup is limited to the signed-in uploader's own photos. The same id on another assessment or for a different file (type, size or SHA-256) is refused with 409. A completed photo is confirmed before the incident's state and the user's current access are checked, as an assessment is. A photo not yet uploaded goes through every check again.
  - **Items saved by an earlier build** have no photo id. One is given and saved on the phone before that photo is sent.
  - **Released apps** that send no id work as before: an unfinished upload of the same file (same uploader, assessment, type, size and SHA-256) is reused.

## Deploying

The photo id needs a database migration and an API change, in this order:

1. **Migration** `20261115090000_emergency_evidence_client_upload_id`: adds the nullable `client_upload_id` column and its unique index. Existing rows and released apps are unaffected.
2. **API:** accepts `clientUploadId` and answers retries as above. Released apps and the dashboard send no id and see the same answers as before, apart from a repeated completion now succeeding instead of returning 409.
3. **Phone app** with this queue. It must not reach users before the API: the API refuses fields it does not know, so an older API would refuse every photo with an id (the item would be kept as blocked until the API is updated).

The dashboard needs no change.

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
