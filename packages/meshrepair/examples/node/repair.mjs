/**
 * Trigasm Node.js Example
 *
 * Demonstrates how to use Trigasm to repair STL files in Node.js
 *
 * Usage:
 *   node repair.mjs input.stl [output.stl]
 */

import { readFile, writeFile } from 'fs/promises';
import { Trigasm, PRESETS } from '@goodtools/trigasm';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node repair.mjs <input.stl> [output.stl]');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.stl$/i, '_repaired.stl');

  console.log(`Loading Trigasm...`);

  // Initialize Trigasm
  const trigasm = await Trigasm.init();

  console.log(`Reading ${inputPath}...`);

  // Read input file
  const inputData = await readFile(inputPath);

  console.log(`Repairing mesh...`);

  // Repair with print-ready preset and progress callback
  const { result, output } = trigasm.repair(
    inputPath.split('/').pop(),
    inputData,
    'print-ready',
    (step, progress) => {
      const pct = (progress * 100).toFixed(0);
      process.stdout.write(`\r  ${step}: ${pct}%`);
      if (progress === 1) console.log();
    }
  );

  // Print statistics
  console.log(`\nRepair complete!`);
  console.log(`  Vertices: ${result.originalVertices} -> ${result.finalVertices}`);
  console.log(`  Faces: ${result.originalFaces} -> ${result.finalFaces}`);
  console.log(`  Duplicate vertices removed: ${result.duplicateVerticesRemoved}`);
  console.log(`  Duplicate faces removed: ${result.duplicateFacesRemoved}`);
  console.log(`  Degenerate faces removed: ${result.degenerateFacesRemoved}`);
  console.log(`  Unreferenced vertices removed: ${result.unreferencedVerticesRemoved}`);
  console.log(`  Holes filled: ${result.holesFilled}`);

  // Write output file
  await writeFile(outputPath, output);
  console.log(`\nSaved repaired mesh to ${outputPath}`);

  // Cleanup
  trigasm.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
