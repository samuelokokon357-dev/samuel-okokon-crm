import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ========================================
// SUPABASE CONFIGURATION
// ========================================

const SUPABASE_URL = "https://wwpjxsmsqdepvqqxcycx.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3cGp4c21zcWRlcHZxcXhjeWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MzQzNzksImV4cCI6MjEwNDMxMDM3OX0.3SU_eY8D4RDLlcNjgQ2cqtkuuHh-itJgpaEa2G55jUM";

// ========================================
// CREATE SUPABASE CLIENT
// ========================================

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);