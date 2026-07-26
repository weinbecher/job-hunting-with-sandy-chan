// data.js — Supabase data layer for Job Hunting with Sandy.
//
// This module owns ALL persistence: auth (email magic-link login), the three data
// tables (applications, cvs, contacts), and CV file storage. app.js keeps an
// in-memory copy of the data for rendering and calls the functions here to load and
// save. Everything is scoped to the logged-in user by the Row-Level-Security policies
// in supabase/schema.sql.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CV_BUCKET = "cv-files";
const PLACEHOLDER_MARKERS = ["YOUR-PROJECT-REF", "YOUR-ANON-PUBLIC-KEY"];

// The tables use a composite primary key (user_id, id), so ids only need to be unique
// per account. This lets deterministic ids (e.g. "sophia-TT-001") coexist across users.
const UPSERT_OPTS = { onConflict: "user_id,id" };

const config = window.SUPABASE_CONFIG || {};

// True only when config.js has been filled in with real values.
export function isConfigured() {
  const url = config.url || "";
  const anonKey = config.anonKey || "";
  if (!url || !anonKey) return false;
  return !PLACEHOLDER_MARKERS.some((marker) => url.includes(marker) || anonKey.includes(marker));
}

// One shared client. Only created when configured so a placeholder config shows the
// setup notice instead of throwing.
export const supabase = isConfigured()
  ? createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getUserId() {
  const session = await getSession();
  return session?.user?.id || null;
}

// Sends a magic-link / one-time-code email. The link returns to this same page.
export async function signInWithEmail(email) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const redirectTo = window.location.href.split("#")[0];
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// ---------------------------------------------------------------------------
// Row mappers (DB snake_case <-> app camelCase)
// ---------------------------------------------------------------------------

function rowToApplication(row) {
  return {
    id: row.id,
    role: row.role || "",
    company: row.company || "",
    jobLink: row.job_link || "",
    source: row.source || "",
    status: row.status || "saved",
    location: row.location || "",
    salary: row.salary || "",
    appliedDate: row.applied_date || "",
    nextAction: row.next_action || "",
    nextActionDate: row.next_action_date || "",
    tags: row.tags || [],
    cvVersion: row.cv_version || "",
    contactId: row.contact_id || "",
    description: row.description || "",
    notes: row.notes || "",
    sourceId: row.source_id || ""
  };
}

function applicationToRow(job) {
  return {
    id: job.id,
    role: job.role || "",
    company: job.company || "",
    job_link: job.jobLink || "",
    source: job.source || "",
    status: job.status || "saved",
    location: job.location || "",
    salary: job.salary || "",
    applied_date: job.appliedDate || "",
    next_action: job.nextAction || "",
    next_action_date: job.nextActionDate || "",
    tags: job.tags || [],
    cv_version: job.cvVersion || "",
    contact_id: job.contactId || "",
    description: job.description || "",
    notes: job.notes || "",
    source_id: job.sourceId || ""
  };
}

function rowToCv(row) {
  return {
    id: row.id,
    name: row.name || "",
    focus: row.focus || "",
    fileName: row.file_name || "",
    fileType: row.file_type || "",
    fileSize: row.file_size || 0,
    hasStoredFile: Boolean(row.has_stored_file),
    storagePath: row.storage_path || "",
    updated: row.updated || "",
    notes: row.notes || ""
  };
}

function cvToRow(cv) {
  return {
    id: cv.id,
    name: cv.name || "",
    focus: cv.focus || "",
    file_name: cv.fileName || "",
    file_type: cv.fileType || "",
    file_size: cv.fileSize || 0,
    has_stored_file: Boolean(cv.hasStoredFile),
    storage_path: cv.storagePath || "",
    updated: cv.updated || "",
    notes: cv.notes || ""
  };
}

function rowToContact(row) {
  return {
    id: row.id,
    name: row.name || "",
    company: row.company || "",
    role: row.role || "",
    link: row.link || "",
    lastContact: row.last_contact || "",
    nextDate: row.next_date || "",
    notes: row.notes || ""
  };
}

function contactToRow(person) {
  return {
    id: person.id,
    name: person.name || "",
    company: person.company || "",
    role: person.role || "",
    link: person.link || "",
    last_contact: person.lastContact || "",
    next_date: person.nextDate || "",
    notes: person.notes || ""
  };
}

// ---------------------------------------------------------------------------
// Fetch everything for the current user
// ---------------------------------------------------------------------------

export async function fetchAll() {
  if (!supabase) return { applications: [], cvs: [], contacts: [] };
  const [apps, cvs, contacts] = await Promise.all([
    supabase.from("applications").select("*").order("created_at", { ascending: false }),
    supabase.from("cvs").select("*").order("created_at", { ascending: false }),
    supabase.from("contacts").select("*").order("created_at", { ascending: false })
  ]);
  if (apps.error) throw apps.error;
  if (cvs.error) throw cvs.error;
  if (contacts.error) throw contacts.error;
  return {
    applications: apps.data.map(rowToApplication),
    cvs: cvs.data.map(rowToCv),
    contacts: contacts.data.map(rowToContact)
  };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function upsertApplication(job) {
  const { error } = await supabase.from("applications").upsert(applicationToRow(job), UPSERT_OPTS);
  if (error) throw error;
}

export async function upsertApplications(jobs) {
  if (!jobs.length) return;
  const { error } = await supabase.from("applications").upsert(jobs.map(applicationToRow), UPSERT_OPTS);
  if (error) throw error;
}

export async function deleteApplication(id) {
  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// CVs
// ---------------------------------------------------------------------------

export async function upsertCv(cv) {
  const { error } = await supabase.from("cvs").upsert(cvToRow(cv), UPSERT_OPTS);
  if (error) throw error;
}

export async function upsertCvs(cvs) {
  if (!cvs.length) return;
  const { error } = await supabase.from("cvs").upsert(cvs.map(cvToRow), UPSERT_OPTS);
  if (error) throw error;
}

export async function deleteCv(id) {
  const { error } = await supabase.from("cvs").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function upsertContact(person) {
  const { error } = await supabase.from("contacts").upsert(contactToRow(person), UPSERT_OPTS);
  if (error) throw error;
}

export async function upsertContacts(contacts) {
  if (!contacts.length) return;
  const { error } = await supabase.from("contacts").upsert(contacts.map(contactToRow), UPSERT_OPTS);
  if (error) throw error;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Job autofill. Calls the parse-job Edge Function, which reads a job advert and
// returns its details as fields. The Anthropic API key lives there, never here —
// this file ships to the browser and is readable by anyone.
//
// Pass a url to have the function fetch the page, or text when the site blocked
// it and the user pasted the description instead.
// ---------------------------------------------------------------------------

export async function parseJob({ url = "", text = "" }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("parse-job", {
    body: { url, text }
  });
  if (error) {
    // Supabase wraps non-2xx responses; dig out the function's own message.
    let message = error.message || "Autofill failed.";
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // Keep the generic message if the body isn't readable.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------------------------------------------------------------------------
// CV file storage. Objects are stored at "<userId>/<cvId>" so the storage RLS
// policies (which check the first path segment) allow only the owner.
// ---------------------------------------------------------------------------

async function cvStoragePath(cvId) {
  const userId = await getUserId();
  if (!userId) throw new Error("Not signed in.");
  return `${userId}/${cvId}`;
}

// Uploads the file and returns its storage path (to save on the cv row).
export async function uploadCvFile(cvId, file) {
  const path = await cvStoragePath(cvId);
  const { error } = await supabase.storage
    .from(CV_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

// Returns a short-lived signed URL for opening/downloading a stored CV file.
export async function getCvFileUrl(storagePath) {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from(CV_BUCKET)
    .createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteCvFile(storagePath) {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(CV_BUCKET).remove([storagePath]);
  if (error) throw error;
}
