package backend

type TerminalProfile struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Model       string `json:"model"`
	Command     string `json:"command"`
	Description string `json:"description"`
}

// Backend is the core business logic shared by the Wails client and terminal.
type Backend struct{}

func New() *Backend {
	return &Backend{}
}

func (b *Backend) Ping() string {
	return "pong"
}

func (b *Backend) TerminalProfiles() []TerminalProfile {
	return []TerminalProfile{
		{
			ID:          "codex",
			Name:        "Codex",
			Model:       "GPT-5.1-Codex",
			Command:     "codex",
			Description: "OpenAI coding agent CLI.",
		},
		{
			ID:          "copilot",
			Name:        "Copilot",
			Model:       "GitHub Copilot CLI",
			Command:     "copilot",
			Description: "GitHub Copilot terminal CLI.",
		},
		{
			ID:          "claude",
			Name:        "Claude",
			Model:       "Claude Code",
			Command:     "claude",
			Description: "Anthropic coding agent CLI.",
		},
		{
			ID:          "gemini",
			Name:        "Gemini",
			Model:       "Gemini CLI",
			Command:     "gemini",
			Description: "Google Gemini terminal CLI.",
		},
		{
			ID:          "junie",
			Name:        "Junie",
			Model:       "JetBrains Junie",
			Command:     "junie",
			Description: "JetBrains AI coding agent CLI.",
		},
	}
}

func (b *Backend) TerminalCount() int {
	return len(b.TerminalProfiles())
}
