// Configuration
const config = {
	// MapTiler configuration
	MAPTILER_KEY: "7i9Te80ntFhqbTPkBXoi",

	// Supabase configuration
	SUPABASE_URL: "https://rsxyheykhgnvmamksioi.supabase.co",
	SUPABASE_ANON_KEY:
		"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzeHloZXlraGdudm1hbWtzaW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTYyMzUsImV4cCI6MjA3MjQ5MjIzNX0.V0j6vDYcOMQ-wne-OmWhcBNSOV7ZjebtWqev7KmQF5s",
};

// Initialize Supabase client
const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
