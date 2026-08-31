import { useMemo } from 'react'
import classArtifactRelationsData from '../data/class-artifact-relations.json'
import type { ClassArtifactRelation } from '../types/classArtifactRelation'
import type { InlineTextLink } from '../types/inlineLink'

const classArtifactRelations = classArtifactRelationsData as ClassArtifactRelation[]

function dedupeInlineLinks(links: InlineTextLink[]): InlineTextLink[] {
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = `${link.text.toLowerCase()}|${link.to}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function useClassArtifactRelationsForClass(classSlug?: string): ClassArtifactRelation[] {
  return useMemo(() => {
    if (!classSlug) return []
    return classArtifactRelations.filter((relation) => relation.classSlug === classSlug)
  }, [classSlug])
}

export function useArtifactInlineLinksForClass(classSlug?: string): InlineTextLink[] {
  return useMemo(() => {
    if (!classSlug) return []
    return dedupeInlineLinks(
      classArtifactRelations
        .filter((relation) => relation.classSlug === classSlug)
        .flatMap((relation) =>
          [relation.artifactName, ...(relation.artifactAliases ?? [])].map((text) => ({
            text,
            to: relation.artifactRoute,
          }))
        )
    )
  }, [classSlug])
}

export function useClassInlineLinksForArtifact(artifactSlug?: string): InlineTextLink[] {
  return useMemo(() => {
    if (!artifactSlug) return []
    return dedupeInlineLinks(
      classArtifactRelations
        .filter((relation) => relation.artifactSlug === artifactSlug)
        .flatMap((relation) =>
          [relation.className, `${relation.className} class`].map((text) => ({
            text,
            to: relation.classRoute,
          }))
        )
    )
  }, [artifactSlug])
}
