import { useMemo } from 'react'
import classArmorRelationsData from '../data/class-armor-relations.json'
import type { ClassArmorRelation } from '../types/classArmorRelation'
import type { AlsoSeeRef } from '../types/item'

const classArmorRelations = classArmorRelationsData as ClassArmorRelation[]

export function getClassArmorAlsoSeeRefs(classSlug: string): AlsoSeeRef[] {
  return classArmorRelations
    .filter((relation) => relation.armorSlug === classSlug || relation.classSlug === classSlug)
    .map((relation) =>
      relation.armorSlug === classSlug
        ? {
            name: relation.className,
            slug: relation.classSlug,
            type: 'class-ability' as const,
          }
        : {
            name: relation.armorName,
            slug: relation.armorSlug,
            type: 'class-ability' as const,
          }
    )
}

export function useClassArmorRelationsForClass(classSlug?: string): ClassArmorRelation[] {
  return useMemo(() => {
    if (!classSlug) return []
    return classArmorRelations.filter(
      (relation) => relation.armorSlug === classSlug || relation.classSlug === classSlug
    )
  }, [classSlug])
}
