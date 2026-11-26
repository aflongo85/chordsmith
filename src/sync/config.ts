/**
 * Supabase project used to sync saved ideas between devices.
 * Both values are public by design (they ship in the browser bundle); access to the data
 * is restricted per user by the Row Level Security policies in supabase/schema.sql.
 * Leave them empty to run the app without sync.
 */
export const SUPABASE_URL: string = 'https://xzdqhobcsvuhmzhitrjw.supabase.co'
export const SUPABASE_KEY: string = 'sb_publishable_wBVrnapRk5KMme49b-MBBw_G1DC6s7b'

export const syncConfigured = (): boolean => SUPABASE_URL !== '' && SUPABASE_KEY !== ''
