import { diff3Merge } from 'node-diff3'

export interface MergeOutcome {
  /** True when both sides touched the same lines and no safe merge exists. */
  conflict: boolean
  /** The merged document; only meaningful when `conflict` is false. */
  merged: string
}

/**
 * Line-wise three-way merge of an edited buffer (`ours`) against a newer
 * on-disk version (`theirs`), both descended from `base`.
 *
 * Non-overlapping edits combine; overlapping ones are reported as a conflict
 * for the user to settle, never resolved by guessing.
 */
export function mergeThreeWay(base: string, ours: string, theirs: string): MergeOutcome {
  const regions = diff3Merge(ours.split('\n'), base.split('\n'), theirs.split('\n'), {
    // Both sides making the identical change is agreement, not a conflict.
    excludeFalseConflicts: true,
  })

  const lines: string[] = []
  for (const region of regions) {
    if (region.conflict) return { conflict: true, merged: ours }
    if (region.ok) lines.push(...region.ok)
  }
  return { conflict: false, merged: lines.join('\n') }
}
