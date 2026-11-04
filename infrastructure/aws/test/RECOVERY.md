# Recovery from the first foundation NAT failure

**Plan for owner review, not authorization to delete anything.** Nothing in this
file or the renderer performs AWS operations. The original account-safety
instruction prohibits deletion of existing resources; obtain explicit owner
approval for the exact recovery actions below before changing protection or
removing any test resource. Keep using the existing account in Singapore.

## Observed failure and inventory

The first foundation execution on 4 November 2026 reached `ROLLBACK_FAILED`.
EC2 console output shows `dnf` was killed for out-of-memory during installation
on the 512 MB `t4g.nano`; AL2023's existing compressed zram swap was exhausted.
The NAT's failure signal cancelled RDS creation. Rollback then could not create
the database's required final snapshot while it was not yet Available.

The owner subsequently verified the database was private, deletion-protected
and `backing-up`. The latest stack-resource inventory showed:

| Resource group | Observed state |
| --- | --- |
| Database, DB subnet group/security group, test VPC and two private subnets | Remain from the failed foundation; database deletion failed |
| Document bucket, build-artifact bucket, Cognito pool | `DELETE_SKIPPED`, retained intentionally |
| NAT instance and the other created network components/client/policy resources shown in inventory | Deleted by rollback |
| Separate encrypted-parameter bootstrap | `CREATE_COMPLETE`, termination-protected, no permanent execution role; both parameters SecureString version 1 |

Record actual resource IDs privately from a fresh inventory before recovery.
CloudFormation status is historical evidence: recheck service state before any
operation. The remaining RDS instance and retained storage/logs can keep charging.
Do not create a parallel database/VPC to work around the failed stack.

## NAT correction and cost

The corrected template enables 2 GiB of disk-backed swap **before** `dnf`, on the
existing encrypted 8 GB gp3 root disk. It leaves `t4g.nano`, disk allocation,
CPU-credit mode, SSH restrictions, IMDSv2 and the standing price forecast unchanged.
Swap is permission 0600 and persists through `/etc/fstab` for later package work.
The ten-minute bootstrap success/failure signal is retained. Database creation now
depends on the NAT instance completing that CreationPolicy, so another NAT
bootstrap failure does not start a new database creation in parallel.

This addresses the measured memory shortfall. Local syntax/lint/assertion checks
do not prove EC2 boot, available disk space, package installation or forwarding.
Confirm these in AWS before declaring recovery successful. The original forecast
remains USD 29.30/month standing foundation compute/storage/network and USD 35.93
for the initial app, before credits/tax. Retained recovery snapshots can add
storage charges; measure them and include them in the existing contingency and
USD 70 ceiling. Do not promise a hard cap or a zero invoice.

## Proposed recovery requiring explicit owner approval

The concrete proposal is to snapshot and replace **only the newly created failed
test database/network**, preserve the two buckets and Cognito pool, and adopt
those three retained resources into a healthy foundation stack. This preserves
their identifiers/data and avoids name collisions or duplicating resources.
The bootstrap stack, encrypted parameters, budget, default VPC, identity settings,
production resources and DNS remain outside this recovery.

1. Review/merge the NAT fix PR and its recovery import template under
   `CONTRIBUTING.md`. Confirm the current account/region and the exact failed
   stack's resource IDs. Explain the proposed removal and obtain owner approval
   **before** protection changes or deletions. If the owner requires the live
   database itself to remain, stop this reset proposal and prepare a separate
   retention/import plan or contact AWS Support; do not force this route.
2. Recheck that the test database is Available and belongs to this failed stack.
   Before deletion, create and verify an encrypted manual recovery snapshot of
   this exact database. Do not infer recoverability merely from `backing-up`.
   Keep the master-password parameter/NIC key and snapshot identifiers private.
3. Only after approval and snapshot verification, temporarily disable termination
   protection on the **failed foundation** and deletion protection on this test
   database. Delete that failed foundation through CloudFormation with its
   normal Snapshot/Retain policies. Do not skip final snapshots, force deletion,
   delete retained buckets/users/parameters or remove the bootstrap. The database
   and remaining test network are removed; database snapshots, buckets and pool
   are preserved. Stop on any unexpected failure and re-inventory.
4. Verify the failed stack's deletion and that the old database/network no longer
   exist, while the two buckets and pool remain. Re-enabling an existing stopped
   stack or re-running a CREATE against those retained resource names is not a
   recovery strategy. `ROLLBACK_FAILED` is not `UPDATE_ROLLBACK_FAILED`; do not
   use `continue-update-rollback` for this state. `RetainResources` is documented
   for `DELETE_FAILED` and is not an assumed shortcut for this failed creation.
5. Prepare an **IMPORT** change set for the now-vacant
   `sarvodaya-connect-test-foundation` name using `retained.import.yaml`.
   Use `get-template-summary` to obtain each resource type's identifier key, then
   build the import manifest locally using the exact retained IDs (two bucket
   names and pool ID). Do not guess identifiers or put account-specific manifests
   into Git. No deployment service role is needed: the owner's CLI session
   previously worked without attaching the broad role-manager admin role.
6. Inspect the import: exactly `Documents`, `Artifacts`, `UserPool`, all actions
   `Import`, no creation/deletion/property changes. All three use `DeletionPolicy:
   Retain`; their definitions are copied unchanged from the full foundation.
   Enable termination protection on the stack before execution. Execute only
   after owner review; wait for `IMPORT_COMPLETE`.
7. Verify imported bucket settings with drift detection and service read APIs.
   Cognito user pools support import but currently do **not** support CloudFormation
   drift detection; compare `describe-user-pool` settings manually. A successful
   import does not establish that service settings match the template.
8. Prepare a separate **UPDATE** change set using the complete corrected
   `foundation.rendered.yaml`. Retain the same imported logical IDs. Expect
   additions for missing network/database/client/policy resources and no
   replacement/deletion of the retained buckets/pool. Inspect actual property
   changes, stop on unexpected changes, and execute only after review. Prefer
   preserving successfully provisioned resources on a new failure, rather than
   repeating the previous automatic full rollback; explain this operational
   choice to the owner before executing.
9. Verify NAT bootstrap/forwarding, private encrypted RDS/backups, Cognito clients,
   private bucket policies, stack protection and actual costs. RDS must wait for
   NAT success. The API/dashboard/migrations, user identities and SarvoAI remain
   separate uncompleted tasks.

No removal command is supplied here to avoid presenting an unapproved cleanup
as an automatic next step. Each mutation will be explained individually in the
owner-driven session after approval.

## Build the reviewed import template offline

```sh
python3 infrastructure/aws/test/render-foundation.py --retained-import > /tmp/retained.import.yaml
cfn-lint /tmp/retained.import.yaml
```

GitHub's `sarvodaya-test-foundation` artifact now contains bootstrap, foundation
and retained-import files from the exact checked commit. `retained.import.yaml`
is **only** for an IMPORT operation after approved recovery, not a normal CREATE.
The renderer never calls AWS, reads secrets, deletes resources or runs migrations.

## Primary references

- [AL2023 memory requirements and nano/zram limitations](https://docs.aws.amazon.com/linux/al2023/ug/system-requirements.html).
- [CloudFormation stack status meanings](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/view-stack-events.html).
- [DeleteStack RetainResources requirements](https://docs.aws.amazon.com/cli/latest/reference/cloudformation/delete-stack.html).
- [Manual resource import: resources must not belong to another stack; import cannot create/delete/change properties](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/import-resources-manually.html).
- [Resource import/drift support: S3 buckets and Cognito pools](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import-supported-resources.html).
- [Preserving successful resources after provisioning failures](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stack-failure-options.html).
