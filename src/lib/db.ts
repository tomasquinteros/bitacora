import Database from "@tauri-apps/plugin-sql";
import { emit, listen } from "@tauri-apps/api/event";

export interface Company {
  id: number;
  name: string;
  color: string;
  position: number;
  archived: number;
}

export interface Section {
  id: number;
  name: string;
  color: string;
  checkable: number;
  carry: number;
  recap: number;
  position: number;
  archived: number;
}

export interface Item {
  id: number;
  company_id: number;
  day: string;
  section_id: number;
  text: string;
  done_on: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  note_count?: number;
  last_note?: string | null;
  last_note_at?: string | null;
}

export interface Note {
  id: number;
  entry_id: number;
  text: string;
  created_at: string;
}

// Cada entrada viene con el resumen de sus notas (cantidad y la última) para no hacer N consultas.
const ITEM = `e.*,
  (SELECT COUNT(*) FROM notes n WHERE n.entry_id = e.id) AS note_count,
  (SELECT text FROM notes n WHERE n.entry_id = e.id ORDER BY n.id DESC LIMIT 1) AS last_note,
  (SELECT created_at FROM notes n WHERE n.entry_id = e.id ORDER BY n.id DESC LIMIT 1) AS last_note_at`;

// Secciones activas cuyas entradas abiertas se arrastran a los días siguientes hasta completarse.
const CARRY = "(SELECT id FROM sections WHERE carry = 1 AND archived = 0)";

let conn: Promise<Database> | null = null;
function db(): Promise<Database> {
  return (conn ??= Database.load("sqlite:bitacora.db"));
}

const CHANGED = "bitacora:changed";

async function changed() {
  await emit(CHANGED);
}

export function onChanged(cb: () => void) {
  return listen(CHANGED, cb);
}

export function isDone(item: Item, day: string): boolean {
  return item.done_on !== null && item.done_on <= day;
}

export function sectionHint(s: Section): string {
  return s.checkable ? `Agregar a ${s.name.toLowerCase()}…` : "Anotar algo…";
}

// --- empresas ---

export async function listCompanies(includeArchived = false): Promise<Company[]> {
  const where = includeArchived ? "" : "WHERE archived = 0";
  return (await db()).select<Company[]>(`SELECT * FROM companies ${where} ORDER BY position, id`);
}

export async function addCompany(name: string, color: string) {
  await (await db()).execute(
    "INSERT INTO companies (name, color, position) VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM companies))",
    [name, color],
  );
  await changed();
}

export async function updateCompany(c: Pick<Company, "id" | "name" | "color" | "position" | "archived">) {
  await (await db()).execute(
    "UPDATE companies SET name = $1, color = $2, position = $3, archived = $4 WHERE id = $5",
    [c.name, c.color, c.position, c.archived, c.id],
  );
  await changed();
}

// --- secciones ---

export async function listSections(includeArchived = false): Promise<Section[]> {
  const where = includeArchived ? "" : "WHERE archived = 0";
  return (await db()).select<Section[]>(`SELECT * FROM sections ${where} ORDER BY position, id`);
}

export async function addSection(s: Pick<Section, "name" | "color" | "checkable" | "carry" | "recap">) {
  await (await db()).execute(
    `INSERT INTO sections (name, color, checkable, carry, recap, position)
     VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(position), -1) + 1 FROM sections))`,
    [s.name, s.color, s.checkable, s.carry, s.recap],
  );
  await changed();
}

export async function updateSection(s: Section) {
  await (await db()).execute(
    `UPDATE sections SET name = $1, color = $2, checkable = $3, carry = $4, recap = $5, position = $6, archived = $7
     WHERE id = $8`,
    [s.name, s.color, s.checkable, s.carry, s.recap, s.position, s.archived, s.id],
  );
  await changed();
}

// --- entradas ---

// Lo del día + lo arrastrado de días anteriores que seguía abierto ese día.
export async function itemsForDay(companyId: number, day: string): Promise<Item[]> {
  return (await db()).select<Item[]>(
    `SELECT ${ITEM} FROM entries e
     WHERE company_id = $1
       AND (day = $2 OR (section_id IN ${CARRY} AND day < $2 AND (done_on IS NULL OR done_on >= $2)))
     ORDER BY position, id`,
    [companyId, day],
  );
}

export async function openCountsForDay(day: string): Promise<Record<number, number>> {
  const rows = await (await db()).select<{ company_id: number; n: number }[]>(
    `SELECT company_id, COUNT(*) AS n FROM entries
     WHERE section_id IN ${CARRY} AND day <= $1 AND (done_on IS NULL OR done_on > $1)
     GROUP BY company_id`,
    [day],
  );
  return Object.fromEntries(rows.map((r) => [r.company_id, r.n]));
}

// Todo lo abierto de todas las empresas (más lo cerrado ese mismo día), de lo más viejo a lo más nuevo.
export async function allOpenForDay(day: string): Promise<Item[]> {
  return (await db()).select<Item[]>(
    `SELECT ${ITEM} FROM entries e JOIN companies c ON c.id = e.company_id
     WHERE c.archived = 0 AND e.section_id IN ${CARRY} AND e.day <= $1 AND (e.done_on IS NULL OR e.done_on >= $1)
     ORDER BY e.day, e.id`,
    [day],
  );
}

export async function lastInSectionBefore(companyId: number, sectionId: number, day: string): Promise<Item | null> {
  const rows = await (await db()).select<Item[]>(
    `SELECT * FROM entries WHERE company_id = $1 AND section_id = $2 AND day < $3
     ORDER BY day DESC, id DESC LIMIT 1`,
    [companyId, sectionId, day],
  );
  return rows[0] ?? null;
}

export async function addItem(companyId: number, day: string, sectionId: number, text: string) {
  await (await db()).execute(
    `INSERT INTO entries (company_id, day, section_id, text, position)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), 0) + 1 FROM entries))`,
    [companyId, day, sectionId, text],
  );
  await changed();
}

export async function updateItemText(id: number, text: string) {
  await (await db()).execute("UPDATE entries SET text = $1, updated_at = datetime('now') WHERE id = $2", [text, id]);
  await changed();
}

export async function setDone(id: number, doneOn: string | null) {
  await (await db()).execute("UPDATE entries SET done_on = $1, updated_at = datetime('now') WHERE id = $2", [doneOn, id]);
  await changed();
}

export async function moveItem(id: number, sectionId: number, position?: number) {
  await (await db()).execute(
    "UPDATE entries SET section_id = $1, position = COALESCE($2, position), updated_at = datetime('now') WHERE id = $3",
    [sectionId, position ?? null, id],
  );
  await changed();
}

export async function deleteItem(id: number) {
  await deleteItems([id]);
}

function placeholders(n: number, from = 1): string {
  return Array.from({ length: n }, (_, i) => `$${i + from}`).join(", ");
}

export interface Deleted {
  items: Item[];
  notes: Note[];
}

export async function deleteItems(ids: number[]): Promise<Deleted> {
  if (!ids.length) return { items: [], notes: [] };
  const d = await db();
  const ph = placeholders(ids.length);
  const items = await d.select<Item[]>(`SELECT * FROM entries WHERE id IN (${ph})`, ids);
  const notes = await d.select<Note[]>(`SELECT * FROM notes WHERE entry_id IN (${ph})`, ids);
  // Explícito: no dependemos de que la conexión tenga foreign_keys activado para el cascade.
  await d.execute(`DELETE FROM notes WHERE entry_id IN (${ph})`, ids);
  await d.execute(`DELETE FROM entries WHERE id IN (${ph})`, ids);
  await changed();
  return { items, notes };
}

// Reinserta con el mismo id y fechas, para que deshacer deje todo como estaba.
export async function restoreItems({ items, notes }: Deleted) {
  const d = await db();
  for (const r of items) {
    await d.execute(
      `INSERT INTO entries (id, company_id, day, section_id, text, done_on, position, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [r.id, r.company_id, r.day, r.section_id, r.text, r.done_on, r.position, r.created_at, r.updated_at],
    );
  }
  for (const n of notes) {
    await d.execute("INSERT INTO notes (id, entry_id, text, created_at) VALUES ($1, $2, $3, $4)", [
      n.id, n.entry_id, n.text, n.created_at,
    ]);
  }
  await changed();
}

// --- notas ---

export async function listNotes(entryId: number): Promise<Note[]> {
  return (await db()).select<Note[]>("SELECT * FROM notes WHERE entry_id = $1 ORDER BY id", [entryId]);
}

export async function addNote(entryId: number, text: string) {
  await (await db()).execute("INSERT INTO notes (entry_id, text) VALUES ($1, $2)", [entryId, text]);
  await changed();
}

export async function deleteNote(id: number) {
  await (await db()).execute("DELETE FROM notes WHERE id = $1", [id]);
  await changed();
}

// --- semana / búsqueda ---

export async function itemsInRange(from: string, to: string): Promise<Item[]> {
  return (await db()).select<Item[]>(
    `SELECT ${ITEM} FROM entries e WHERE (day BETWEEN $1 AND $2) OR (done_on BETWEEN $1 AND $2) ORDER BY day, id`,
    [from, to],
  );
}

export async function openItemsAsOf(day: string): Promise<Item[]> {
  return (await db()).select<Item[]>(
    `SELECT ${ITEM} FROM entries e
     WHERE section_id IN ${CARRY} AND day <= $1 AND (done_on IS NULL OR done_on > $1)
     ORDER BY day, id`,
    [day],
  );
}

export async function searchItems(q: string): Promise<Item[]> {
  return (await db()).select<Item[]>(
    `SELECT ${ITEM} FROM entries e
     WHERE e.text LIKE $1 OR EXISTS (SELECT 1 FROM notes n WHERE n.entry_id = e.id AND n.text LIKE $1)
     ORDER BY day DESC, id DESC LIMIT 200`,
    [`%${q}%`],
  );
}
