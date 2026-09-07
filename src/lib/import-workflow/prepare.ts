import { contributionFromManifest, parseContribution, type Contribution } from '../contributions'
import { checkAvery94502Compatibility } from '../sheets'
import { parseRetrospective, RETROSPECTIVE_KEY, type Retrospective } from '../feedback/retrospective'
import { websiteValidation } from '../contributions/validation'
import { resolveProtocolContext } from '../protocol'
import { prepareImport, type CollectionOrigin } from '../collection'
import type { CellarPackImportResult } from '../cellarpack'
import { buildFallbackRepairPrompt } from './repair-fallback'

/** Adapt validated pack contents to the supported printer and prepare optional diagnostics.
 * The importer owns aggregate issues, including quarantine failures. Append only new
 * compatibility failures so counts and the bounded repair request remain accurate.
 */
export async function preparePackImport(result: CellarPackImportResult, title: string, origin: CollectionOrigin, publicationId?: string) {
  const context = resolveProtocolContext(result.manifest?.extensions)
  const issues = [...result.issues]
  const quarantinedLabels = [...result.quarantinedLabels]
  const usable = result.labels.filter(item => {
    const compatibility = checkAvery94502Compatibility(item.label.surface)
    if (compatibility.compatible) return true
    const failures = compatibility.issues.map(issue => ({ ...issue, labelId: item.id, severity: 'error' as const, recovery: 'Return this label as a 2.5-inch circle for Avery 94502. Do not stretch the artwork.' }))
    issues.push(...failures); quarantinedLabels.push({ id: item.id, label: item.label, issues: failures })
    return false
  })
  const status = usable.length ? (quarantinedLabels.length || result.status !== 'ready' || issues.some(issue => ['fatal', 'error'].includes(issue.severity)) ? 'partial' : 'ready') : 'rejected'
  let contribution: Contribution | null = null
  let retrospective: Retrospective | null = null
  let diagnosticWarning = false
  if (origin === 'local' && result.manifest) {
    try {
      const prepared = await contributionFromManifest(result.manifest, websiteValidation(status, issues))
      contribution = prepared ? parseContribution(prepared) : null
      if (prepared && !contribution) diagnosticWarning = true
    } catch { diagnosticWarning = true }
    if (contribution?.feedback && 'protocolRevision' in contribution.feedback) {
      try {
        const parsed = parseRetrospective(result.manifest.extensions?.[RETROSPECTIVE_KEY])
        if (parsed && parsed.protocolRevision === contribution.feedback.protocolRevision) retrospective = parsed
      } catch { diagnosticWarning = true }
    }
  }
  let repairPrompt = ''
  if (status !== 'ready') {
    try { repairPrompt = (await import('../prompt')).buildCellarPackRepairPrompt(issues, context) }
    catch {
      // Instruction delivery is optional to importing already validated artwork.
      repairPrompt = buildFallbackRepairPrompt(issues)
    }
  }
  const incoming = await prepareImport({ ...result, labels: usable, quarantinedLabels, issues, status }, { origin, publicationId, protocolContext: context, repairPrompt, contribution })
  incoming.receipt.title = (result.manifest?.title ?? title).slice(0, 300)
  return { incoming, retrospective, diagnosticWarning }
}
