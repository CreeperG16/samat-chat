import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./constants.js";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
