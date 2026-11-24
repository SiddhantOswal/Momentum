#!/usr/bin/env bash
# Starts one outside-agent session with the project's fixed safety flags:
# no network (so it cannot push or reach Google Cloud), write access only to its own worktree,
# the model and effort set explicitly, and cloud credentials hidden from the environment.
# Usage: codex-session.sh <builder|reviewer> <role> <packet-file-name> <worktree> <report-file>
# DRY_RUN=1 prints the command instead of running it.
set -euo pipefail

kind="${1:?builder or reviewer}"; role="${2:?role}"; packet="${3:?packet file name}"; worktree="${4:?worktree}"; report="${5:?report file}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
ext="$root/docs/arc/delivery/external"
model="${CODEX_MODEL:-gpt-6.2-sol}"
effort="${CODEX_EFFORT:-medium}"

case "$kind" in
  builder)
    task="You are the $role. Read $ext/roles/$role.md, then your packet $ext/packets/$packet, and do exactly what they say. Your worktree is your current directory, already on your branch. Your sandbox has no network and you cannot commit: leave your work uncommitted and write commit-plan.json at its root as the packet describes. Do not push, do not edit STATUS.md, and make no Google Cloud change." ;;
  reviewer)
    task="You are the $role. Read $ext/roles/$role.md, then your review packet $ext/packets/$packet, and do exactly what they say. Your current directory is a checkout of the work under review. Revert every mutation before you finish and never commit. Your sandbox has no network and cannot start local servers." ;;
  *) echo "First argument must be builder or reviewer." >&2; exit 2 ;;
esac

empty_cloud_config="${TMPDIR:-/tmp}/arc-empty-cloud-config"
mkdir -p "$empty_cloud_config"
cmd=(codex exec -m "$model" -c "model_reasoning_effort=$effort" -C "$worktree" -s workspace-write --ephemeral -o "$report" "$task")

if [ "${DRY_RUN:-}" = "1" ]; then
  printf 'CLOUDSDK_CONFIG=%s ' "$empty_cloud_config"; printf '%q ' "${cmd[@]}"; printf '\n'; exit 0
fi

env -u GOOGLE_APPLICATION_CREDENTIALS -u GOOGLE_CLOUD_PROJECT -u GCLOUD_PROJECT CLOUDSDK_CONFIG="$empty_cloud_config" "${cmd[@]}"
