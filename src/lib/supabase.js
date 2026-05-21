import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Implicit flow puts tokens directly in the URL hash after email confirmation.
    // This works on any device/browser — including when the user registers on their
    // phone but clicks the confirmation link in Gmail's webview or on a laptop.
    // PKCE (the default) requires the same browser session that initiated sign-up,
    // which breaks cross-device confirmation and shows "can't connect to server".
    flowType: 'implicit',
  },
})
