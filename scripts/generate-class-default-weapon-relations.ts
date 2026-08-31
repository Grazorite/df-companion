import path from 'node:path'
import { writeClassDefaultWeaponRelations } from './lib/class-default-weapon-relations.ts'

const DATA_DIR = path.resolve(import.meta.dirname, '../src/data')
const relations = writeClassDefaultWeaponRelations(DATA_DIR)
console.log(`✅ class-default-weapon-relations.json written: ${relations.length} relation(s)`)
