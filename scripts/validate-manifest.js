#!/usr/bin/env node

const fs = await import('fs');
const path = await import('path');

const manifestPath = path.resolve(import.meta.dirname, '../docs/operations/current-deployment-status.yaml');
if (!fs.existsSync(manifestPath)) {
  console.error("Error: current-deployment-status.yaml not found.");
  process.exit(1);
}

const content = fs.readFileSync(manifestPath, 'utf8');

const getValue = (key) => {
  const regex = new RegExp(`^\\s*${key}\\s*:\\s*(.*)$`, 'm');
  const match = content.match(regex);
  if (!match) return null;
  let val = match[1].trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  return val;
};

const getEvidenceRefsStr = () => {
  let inRefs = false;
  let lines = content.split('\n');
  let refs = [];
  for (let line of lines) {
    if (line.startsWith('evidence_refs:')) {
      inRefs = true;
      let val = line.substring('evidence_refs:'.length).trim();
      if (val && val !== '[]') refs.push(val);
      continue;
    }
    if (inRefs) {
      if (line.trim().startsWith('-')) {
        refs.push(line);
      } else if (line.trim() === '') {
        // continue
      } else if (!line.startsWith(' ')) {
        inRefs = false;
      }
    }
  }
  return refs;
};

const requiredFields = [
  'environment',
  'observed_at',
  'app_commit',
  'artifact_sha256',
  'schema_version',
  'catalog_runtime',
  'ledger_append_only',
  'legacy_contract_state',
  'backup_artifact_sha256',
  'opening_timestamp',
  'evidence_refs'
];

let failed = false;
for (const field of requiredFields) {
  if (field !== 'evidence_refs' && getValue(field) === null) {
     console.error(`Error: Missing required field: ${field}`);
     failed = true;
  }
}

const evidenceRefs = getEvidenceRefsStr();
const hasEvidence = evidenceRefs.length > 0;

const fieldsToCheck = [
  'catalog_runtime',
  'ledger_append_only',
  'legacy_contract_state',
  'schema_version',
  'app_commit'
];

for (const field of fieldsToCheck) {
  const val = getValue(field);
  if (!val) continue;
  if (!hasEvidence && val.toLowerCase().includes('verified')) {
    console.error(`Error: Field '${field}' has value '${val}' (contains 'verified'), but evidence_refs is empty.`);
    failed = true;
  }
}

if (failed) {
  console.error("Validation failed: validator requires correct schema and evidence if 'verified' is claimed.");
  process.exit(1);
}

console.log("Validation passed: current-deployment-status.yaml is valid.");