import path from 'node:path'
import { writeClassArmorRelations } from './lib/class-armor-relations.ts'

const DATA_DIR = path.resolve(import.meta.dirname, '../src/data')
const relations = writeClassArmorRelations(DATA_DIR)
console.log(`✅ class-armor-relations.json written: ${relations.length} relation(s)`)
