export interface ClassArtifactRelation {
  className: string
  classSlug: string
  classSubcategory?: string
  classRoute: string
  artifactName: string
  artifactSlug: string
  artifactSubtype: string
  artifactRoute: string
  artifactAliases?: string[]
}
