# Membership figures

Sarvodaya Connect keeps two different member numbers for a society. The Membership views (HQ's D08 and the DM, DDM and SPC views from issue #118) show both, but never add one to the other.

| Number | Where it is stored | Female/male split | Categories | Used for |
|---|---|---|---|---|
| Profile member count | `societies.member_count`, entered on the society profile | No | No | The society record, the role homes and the society lists ("Members") |
| Category counts | `society_membership_counts`, one row per society, year and category | Yes | Child, Youth, Mothers, Ordinary, Elders' Council | Every total, percentage and table on the Membership views |

## Why the numbers can differ

A district can show 2,040 members on the phone's DM overview while Membership shows 0 reported. That happens when societies have a profile member count but have not yet entered category counts for any year. The overview adds up profile counts; Membership adds up category counts.

The Membership views therefore:

- count only active societies;
- use the latest year that has category counts from the societies in view;
- treat a society as reported when its category counts for that year add up to more than zero;
- show the profile total in its own panel, with how many of those societies have no category counts, instead of putting it into the female/male or category figures;
- say "No membership counts yet" when no society in view has category counts, so a zero is not read as zero members.

## Who sees what

| Role | Societies counted |
|---|---|
| HQ | Every society (`GET /national/membership`) |
| DM | Societies in their own district (`GET /home/membership`) |
| SPC | Societies assigned to them, whatever district is on their account |
| DDM | Societies assigned to them; with `?scope=DISTRICT`, the whole district, only while a temporary grant has started, has not expired and has not been revoked |

The API limits the database query to these societies. The district table lists only districts that hold societies in view, and its "active societies" column counts only those societies.
