# Membership figures

Sarvodaya Connect keeps two different sets of member numbers for a society. The Membership views (HQ's D08 and the DM, DDM and SPC views from issue #118) show both, but never add one to the other.

| Numbers | Where they are stored | Female/male split | Categories | Used for |
|---|---|---|---|---|
| Profile members | `societies.member_count`, `female_members` and `male_members`, entered on the society profile (Edit Society Information) | Yes, once entered (issue #141) | No | The society record, the role homes, the society lists and the first section of every Membership view |
| Category counts | `society_membership_counts`, one row per society, year and category | Yes | Child, Youth, Mothers, Ordinary, Elders' Council | The category and district tables on the Membership views |

## Profile members (issue #141)

The Society Officer (and the SPC, DDM or HQ who may edit the society) types the female and male members. The total is worked out from them and is never typed.

- **The server works out the total.** `PATCH /societies/:id/profile` takes `femaleMembers` and `maleMembers` together, each a whole number from 0 to 1,000,000 and 1,000,000 in all, and saves `memberCount` as their sum. A `memberCount` sent with them must equal the sum or the request is refused.
- **The database enforces it.** The check `societies_member_split_check` allows either no split (both `NULL`) or a split where both counts are 0 or more and `member_count = female_members + male_members`.
- **Zero is a count.** `0` female is an entered value. A missing split is `NULL`, never `0`.
- **Saving again replaces.** Every view adds up each society's latest saved values, so changing female from 25 to 30 raises every total by 5, and saving the same values again (or retrying) changes nothing and adds no history entry.
- **Editing is unchanged.** Only HQ and the Society Officer, SPC or DDM assigned to the society can save. A DM, or anyone who can only view Membership, cannot.

### Existing societies

The migration `20261112090000_society_member_split` only adds the two columns and the check. Existing societies keep their `member_count` with no split, so nothing is guessed or reset. Until someone enters the split:

- the record shows "418 · female/male not entered yet";
- the edit form shows the old total and says it stays until female and male are entered;
- Membership adds the total to "Total members" but not to female or male, and says how many societies have a total but no split, so female and male can add up to less than the total.

Once the split is entered it cannot be removed again from the form; it can only be changed.

### Apps from before #141

Older phone apps still send `memberCount` alone. The API accepts that only while the society has no split (or when it equals the split already saved, as when an old form is saved unchanged). If the split exists and an old app sends a different total, the save is refused with "This society records female and male members. Update those instead", so an old app can never make the total disagree with female and male. Older apps ignore the new response fields.

## Under 18s and Last updated (issue #143)

The phone's society record has a **Members & Exco** tab (it was **Exco**). It starts with a **Members** card (total, female, male and under 18s) and its own **Edit** for people who may edit the society. Below the card is the membership **Last updated** time, then the unchanged 25 Exco seats under "Exco · 25 Seats". The card is the society's members, not the Exco seat count.

- **Under 18s are a part of the total.** `societies.under_18_members` counts members younger than 18, who are already counted as female or male. It is never added to the total: female 25, male 17 and under 18s 10 is a total of 42. It is not the Youth (15–25) category, and nothing is copied between them.
- **Rules.** `PATCH /societies/:id/profile` takes `under18Members`, a whole number from 0 to female + male. It needs the female/male split, sent with it or already saved, so an older total-only record cannot get under 18s alone. A save that would lower female + male below the saved under 18s is refused until the under 18s are changed too. The check `societies_under_18_check` enforces the same in the database.
- **Last updated is membership only.** `societies.membership_updated_at` moves only when a save changes the total, female, male or under 18s. Other profile edits, Exco edits and retried saves with the same figures leave it alone. Creating a society sets it. The record returns it as `membershipUpdatedAt`; the phone shows it in Sri Lanka time.
- **Existing societies.** The migration `20261112100000_society_under_18_members` adds both columns with no values. Nothing is guessed: the card says "Not entered" for each missing figure and "Last updated: not recorded yet" until the first membership save. Once entered, under 18s can be changed (0 is a figure) but not cleared.
- **One data flow.** The card's Edit and Edit Society Information save through the same endpoint and the same `memberCount`, so the Membership views (above) count the same saved total once. Under 18s are not yet shown on the dashboard or in the Membership views.

## Why the profile and category numbers can differ

Category counts are entered separately for each year by category. A society can have profile members but no category counts, or the reverse. The Membership views therefore:

- count only active societies;
- show the profile members first ("Members on Society Profiles": total, female, male, how many societies have entered their split);
- show the category counts below, under "Category counts · {year}", using the latest year that has category counts from the societies in view;
- treat a society as reported when its category counts for that year add up to more than zero;
- say how many societies with a profile total have no category counts for that year;
- say "No membership counts yet" when no society in view has category counts, so a zero is not read as zero members.

Neither set is added to the other, and no category numbers are made up from the profile split.

## Who sees what

| Role | Societies counted |
|---|---|
| HQ | Every active society (`GET /national/membership`, with `profile`) |
| DM | Societies in their own district (`GET /home/membership`) |
| SPC | Societies assigned to them, whatever district is on their account |
| DDM | Societies assigned to them; with `?scope=DISTRICT`, the whole district, only while a temporary grant has started, has not expired and has not been revoked |

The API limits the database query to these societies. The district table lists only districts that hold societies in view, and its "active societies" column counts only those societies. The `profile` object (`societies`, `members`, `withoutBreakdown`, `withSplit`, `female`, `male`) is worked out the same way for HQ (in SQL) and for the scoped views.
