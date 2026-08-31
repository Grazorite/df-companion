import { useMemo } from 'react'
import classDefaultWeaponRelationsData from '../data/class-default-weapon-relations.json'
import type { ClassDefaultWeaponRelation } from '../types/classDefaultWeaponRelation'

const classDefaultWeaponRelations =
  classDefaultWeaponRelationsData as ClassDefaultWeaponRelation[]

export function useClassDefaultWeaponRelationForClass(
  classSlug?: string,
  weaponName?: string
): ClassDefaultWeaponRelation | undefined {
  return useMemo(() => {
    if (!classSlug) return undefined
    const relations = classDefaultWeaponRelations.filter(
      (relation) => relation.classSlug === classSlug
    )
    if (!weaponName) return relations[0]
    return (
      relations.find(
        (relation) =>
          relation.weaponName.toLowerCase() === weaponName.toLowerCase() ||
          relation.weaponName.toLowerCase().startsWith(`${weaponName.toLowerCase()} `)
      ) ?? relations[0]
    )
  }, [classSlug, weaponName])
}

export function useClassDefaultWeaponRelationsForWeapon(
  weaponSlug?: string
): ClassDefaultWeaponRelation[] {
  return useMemo(() => {
    if (!weaponSlug) return []
    return classDefaultWeaponRelations.filter((relation) => relation.weaponSlug === weaponSlug)
  }, [weaponSlug])
}
