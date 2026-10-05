/**
 * MeshRepair Node.js Example
 *
 * Demonstrates how to use MeshRepair to repair STL files in Node.js
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MeshRepair } from '@goodtools/meshrepair'
import loadMeshRepair from '@goodtools/meshrepair/wasm'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  // Get input file from command line or use default
  const inputFile = process.argv[2]
  if (!inputFile) {
    console.error('Usage: node repair.mjs <input.stl> [output.stl]')
    process.exit(1)
  }

  const outputFile = process.argv[3] || inputFile.replace('.stl', '_repaired.stl')

  console.log(`Loading MeshRepair...`)

  // Initialize MeshRepair
  const meshrepair = await MeshRepair.init(loadMeshRepair)

  console.log(`Reading ${inputFile}...`)
  const inputData = readFileSync(inputFile)

  console.log(`Repairing...`)

  // Repair with print-ready preset
  const { result, output } = meshrepair.repair(
    inputFile.split('/').pop(),
    inputData,
    'print-ready',
    (step, progress) => {
      console.log(`  ${step}: ${(progress * 100).toFixed(0)}%`)
    },
  )

  console.log('\nRepair complete!')
  console.log(`  Original: ${result.originalVertices} vertices, ${result.originalFaces} faces`)
  console.log(`  Final: ${result.finalVertices} vertices, ${result.finalFaces} faces`)
  console.log(`  Duplicate vertices removed: ${result.duplicateVerticesRemoved}`)
  console.log(`  Duplicate faces removed: ${result.duplicateFacesRemoved}`)
  console.log(`  Degenerate faces removed: ${result.degenerateFacesRemoved}`)
  console.log(`  Holes filled: ${result.holesFilled}`)

  console.log(`\nWriting ${outputFile}...`)
  writeFileSync(outputFile, output)

  console.log('Done!')

  // Cleanup
  meshrepair.destroy()
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
