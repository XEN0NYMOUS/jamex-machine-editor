import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'storage');
const TEMP_DIR = path.join(STORAGE_DIR, 'temp');
const PROCESSED_DIR = path.join(STORAGE_DIR, 'processed');
const META_DIR = path.join(STORAGE_DIR, 'meta');

const jobLocks = new Map();

async function acquireLock(jobId) {
  while (jobLocks.get(jobId)) {
    await new Promise(r => setTimeout(r, 5));
  }
  jobLocks.set(jobId, true);
}

function releaseLock(jobId) {
  jobLocks.delete(jobId);
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function init() {
  await ensureDir(TEMP_DIR);
  await ensureDir(PROCESSED_DIR);
  await ensureDir(META_DIR);
}

await init();

export function getJobTempDir(jobId) {
  return path.join(TEMP_DIR, jobId);
}

function getJobProcessedDir(jobId) {
  return path.join(PROCESSED_DIR, jobId);
}

function getMetaPath(jobId) {
  return path.join(META_DIR, `${jobId}.json`);
}

export async function saveFile(file, jobId) {
  const jobDir = getJobTempDir(jobId);
  await ensureDir(jobDir);
  const destPath = path.join(jobDir, file.filename || file.originalname);
  if (file.buffer) {
    await fs.writeFile(destPath, file.buffer);
  } else if (file.path) {
    await fs.rename(file.path, destPath);
  } else {
    throw new Error('No file data available');
  }
  return destPath;
}

export function getJobFolder(jobId) {
  return getJobTempDir(jobId);
}

export async function updateJobMeta(jobId, data) {
  await acquireLock(jobId);
  try {
    await ensureDir(META_DIR);
    const metaPath = getMetaPath(jobId);
    let existing = {};
    try {
      const raw = await fs.readFile(metaPath, 'utf-8');
      existing = JSON.parse(raw);
    } catch {}

    const existingImages = (existing && existing.images) || {};
    const newImages = (data && data.images) || {};
    const mergedImages = { ...existingImages, ...newImages };

    const vals = Object.values(mergedImages);
    const completedCount = vals.filter(i => i.status === 'completed').length;
    const failedCount = vals.filter(i => i.status === 'failed').length;

    const merged = {
      ...existing,
      ...data,
      images: mergedImages,
      completed: completedCount,
      failed: failedCount,
      total: existing.total || Object.keys(mergedImages).length,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(metaPath, JSON.stringify(merged, null, 2));
    return merged;
  } finally {
    releaseLock(jobId);
  }
}

export async function getJobMeta(jobId) {
  const metaPath = getMetaPath(jobId);
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cleanupJob(jobId) {
  const tempDir = getJobTempDir(jobId);
  const processedDir = getJobProcessedDir(jobId);
  const metaPath = getMetaPath(jobId);

  for (const dir of [tempDir, processedDir]) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {}
  }

  try {
    await fs.unlink(metaPath);
  } catch {}
}

export async function cleanupOldJobs() {
  const maxAge = 60 * 60 * 1000;
  const now = Date.now();

  try {
    const metaFiles = await fs.readdir(META_DIR);
    const jobs = metaFiles
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));

    for (const jobId of jobs) {
      const meta = await getJobMeta(jobId);
      if (meta) {
        const updated = new Date(meta.updatedAt || meta.createdAt || now).getTime();
        if (now - updated > maxAge) {
          await cleanupJob(jobId);
        }
      }
    }
  } catch (err) {
    console.error('[cleanupOldJobs] Error:', err.message);
  }
}

export async function getJobProcessedFiles(jobId) {
  const dir = getJobProcessedDir(jobId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => ({
      name: e.name,
      path: path.join(dir, e.name),
    }));
  } catch {
    return [];
  }
}

export { TEMP_DIR, PROCESSED_DIR, META_DIR };
