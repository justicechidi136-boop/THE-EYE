# Firebase Storage Cutover

## Current

THE EYE currently keeps MinIO/S3 available as the legacy binary media store and uses PostgreSQL for evidence records, relationships, ownership, object paths, hashes, sizes, MIME types, timestamps, duration, authorization metadata, and audit metadata.

## Target

Firebase Storage becomes the authoritative binary media store. THE EYE API remains the authorization and control plane: clients request an authorized path from the API, upload through a short-lived signed URL, then submit metadata back to the API.

The Firebase bucket must stay private. Do not enable anonymous read/write access and do not use permanent public download URLs for evidence.

## Staging

- Firebase project: `the-eye-2stg`
- Firebase Storage bucket: `the-eye-2stg.firebasestorage.app`
- Required API config:
  - `STORAGE_PROVIDER=firebase`
  - `FIREBASE_PROJECT_ID=the-eye-2stg`
  - `FIREBASE_STORAGE_BUCKET=the-eye-2stg.firebasestorage.app`
  - service-account credentials via the existing API credential mechanism

## Production

Existing configuration identifies the production Firebase project and bucket as:

- Firebase project: `the-eye-2pd-d0217`
- Firebase Storage bucket: `the-eye-2pd-d0217.firebasestorage.app`

This document does not configure or deploy production.

## Cutover Order

1. Add the storage provider implementation.
2. Verify staging credential IAM access to sign Firebase Storage URLs.
3. Run a Firebase Storage smoke test through THE EYE API.
4. Run physical Android evidence QA.
5. Make Firebase Storage authoritative for new staging media.
6. Inventory legacy MinIO objects.
7. Migrate legacy objects only after explicit approval, if needed.
8. Remove MinIO public routing later.
9. Retire MinIO only after explicit approval.

## Legacy MinIO Compatibility

Do not delete MinIO, the existing bucket, S3 signing code, storage DNS, Nginx routing, TLS material, or old stored evidence during the provider cutover. Existing persisted records keep their object paths and bucket values; future Firebase records use the Firebase bucket while preserving the same canonical path prefixes such as `evidence/`, `vehicles/`, `avatars/`, `support/`, and `drone-operators/`.

## Staging Deploy Wiring

Staging deployment must set `STORAGE_PROVIDER=firebase` and `FIREBASE_STORAGE_BUCKET=the-eye-2stg.firebasestorage.app` before Firebase Storage runtime certification. In Firebase mode, the deploy gate validates the staging Firebase project, staging bucket, and service-account credential mechanism, and it does not require `STAGING_STORAGE_HOST`, `THE_EYE_STORAGE_SERVER_NAME`, or `S3_PUBLIC_ENDPOINT` for the active evidence store.

For rollback, `STORAGE_PROVIDER=s3` keeps the legacy public storage host validation and may continue to use `STAGING_STORAGE_HOST`, `THE_EYE_STORAGE_SERVER_NAME`, and `S3_PUBLIC_ENDPOINT`.
