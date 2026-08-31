import path from 'node:path'
import { writeClassArtifactRelations } from './lib/class-artifact-relations'

const dataDir = path.resolve(import.meta.dirname, '../src/data')
const relations = writeClassArtifactRelations(dataDir)
console.log(`✅ class-artifact-relations.json written: ${relations.length} relation(s)`)
