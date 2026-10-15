> **Current reconciliation —15 October 2026:** Owner reconfirmed **Approach B; Firebase remains separate**. See [P0_CLOSURE_RECONCILIATION.md](P0_CLOSURE_RECONCILIATION.md) and `docs/evidence/p0-reconciliation-20261015/`. The original plan below is historical: counter rules/transactions, budget correction, audit schema and authorized optimizer retry have already completed. Do not rerun them. Existing Firestore/runtime configuration is verified. Firebase registration/configuration still returns404 after the earlier403registration attempt; optional production-style setup remains incomplete, not a mandatory hackathon prerequisite. Existing custom Auth role/binding contains only `firebaseauth.users.get`; no additional IAM grant is presently proposed. No cloud mutation or new provider call was performed in this reconciliation.

# Firebase supervisor authentication setup (operator runbook)

This integration is present in application code but deliberately disabled until
an owner configures and verifies Firebase Authentication for `prepagent-hack`.
The application does not create Firebase resources, assign roles, or expose a
claim-assignment endpoint.

## Required owner actions

1. Confirm whether `prepagent-hack` is registered as a Firebase project. If it
   is not, decide whether to add Firebase to the existing project; do not create
   a separate project for this prototype without an explicit architecture
   decision.
2. Enable Firebase Authentication / Identity Platform and the Google sign-in
   provider. Add the intended Cloud Run hostname and local development host to
   the provider's authorized domains. These steps can require API enablement,
   console configuration, and a billing/plan review.
3. Register a web app and supply the public client configuration as Cloud Run
   environment variables: `USTAAD_FIREBASE_WEB_API_KEY`,
   `USTAAD_FIREBASE_AUTH_DOMAIN`, and `USTAAD_FIREBASE_WEB_APP_ID`. These are
   browser configuration values, not Admin credentials. Set
   `USTAAD_FIREBASE_AUTH_ENABLED=true` only after configuration is reviewed.
4. Grant the runtime service account only the Firebase Auth permission needed
   for ID-token verification with revocation checks (`firebaseauth.users.get`)
   using an owner-reviewed minimal role. Do not grant broad IAM permissions as
   a shortcut. The application uses Cloud Run Application Default Credentials;
   do not create or mount a service-account private key.
5. Assign `role: "supervisor"` as a trusted custom claim to each specifically
   approved UID through an owner-controlled administrative process. The app
   accepts Google-provider tokens only. The latest owner direction requires
   `USTAAD_SUPERVISOR_UID_ALLOWLIST` with exact approved UIDs; an empty allowlist
   keeps authentication unavailable. Never accept a
   role, UID, or email supplied in request headers or request bodies.
6. In a separately approved private acceptance run, test missing, malformed,
   expired, revoked, wrong-project, non-supervisor and valid supervisor tokens
   before attempting any privileged workflow.

## Current state and boundary

Read-only inspection on 15 October 2026 found the existing Firestore default
database, but did not find `identitytoolkit.googleapis.com` or
`firebase.googleapis.com` enabled. The available local `gcloud` version did
not expose the Identity Platform configuration command. No Firebase project
registration, Authentication configuration, provider setup, API activation,
IAM change, user creation, custom-claim assignment, or Firestore counter setup
was performed. Current runtime authorization therefore remains unavailable
and privileged Cloud Run routes fail closed.

The app's daily Gemini cap defaults to 100 attempted provider requests per
Asia/Kolkata calendar day. Stage A now includes a locally tested transactional
REST counter using the existing `(default)` Firestore database. It remains
disabled without explicit owner approval and runtime flags. Local maps remain
isolated-process only. No real counter reservation, sign-in, role assignment or
cloud configuration change was performed. The exact inventory, minimal IAM
diff, setup commands, cost assumptions, acceptance and rollback are in
[STAGE_A_APPROVAL_PLAN.md](STAGE_A_APPROVAL_PLAN.md). Do not turn on live Gemini
calls or run photo classification until shared accounting is accepted and usage
is independently known.

No pricing or quota guarantee is implied by Firebase setup. The project owner
must confirm Firebase Authentication/Identity Platform pricing, quotas and
billing impact before enabling it. A daily request count and Cloud Billing
budget notifications are not hard monetary spending limits.
