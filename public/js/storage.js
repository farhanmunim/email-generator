// Local project persistence (localStorage) with an in-memory fallback when
// storage is blocked or full, so the editor keeps working either way.

import { normalizeDoc } from './blocks.js';

const PROJECTS_KEY = 'emailbuilder:v1:projects';
const CURRENT_KEY = 'emailbuilder:v1:current';

let memory = {};
let memoryCurrent = null;
let persistent = true;

function readAll() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    persistent = false;
    return memory;
  }
}

function writeAll(map) {
  memory = map;
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(map));
    persistent = true;
    return { ok: true };
  } catch (error) {
    persistent = false;
    return { ok: false, error };
  }
}

export const isPersistent = () => persistent;

export function listProjects() {
  return Object.values(readAll())
    .filter((p) => p && typeof p === 'object' && typeof p.id === 'string')
    .map((p) => ({
      id: p.id,
      name: typeof p.name === 'string' ? p.name : 'Untitled email',
      updatedAt: Number(p.updatedAt) || 0,
      blockCount: Array.isArray(p.blocks) ? p.blocks.length : 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id) {
  const raw = readAll()[id];
  if (!raw) return null;
  try {
    return normalizeDoc(raw);
  } catch {
    return null;
  }
}

export function saveProject(doc) {
  const map = { ...readAll() };
  map[doc.id] = doc;
  return writeAll(map);
}

export function deleteProject(id) {
  const map = { ...readAll() };
  delete map[id];
  return writeAll(map);
}

export function getCurrentId() {
  try {
    return localStorage.getItem(CURRENT_KEY) || memoryCurrent;
  } catch {
    return memoryCurrent;
  }
}

export function setCurrentId(id) {
  memoryCurrent = id;
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* ignore – memory fallback already set */
  }
}
