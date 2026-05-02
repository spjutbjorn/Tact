package backend

type TerminalProfile struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Model          string `json:"model"`
	Command        string `json:"command"`
	InstallCommand string `json:"installCommand"`
	Description    string `json:"description"`
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
			ID:             "codex",
			Name:           "Codex",
			Model:          "GPT-5.1-Codex",
			Command:        "codex /status",
			InstallCommand: "npm install -g @openai/codex",
			Description:    "OpenAI coding agent CLI.",
		},
		{
			ID:             "copilot",
			Name:           "Copilot",
			Model:          "GitHub Copilot CLI",
			Command:        "copilot",
			InstallCommand: "npm install -g @github/copilot",
			Description:    "GitHub Copilot terminal CLI.",
		},
		{
			ID:             "claude",
			Name:           "Claude",
			Model:          "Claude Code",
			Command:        "claude",
			InstallCommand: "npm install -g @anthropic-ai/claude-code",
			Description:    "Anthropic coding agent CLI.",
		},
		{
			ID:             "gemini",
			Name:           "Gemini",
			Model:          "Gemini CLI",
			Command:        "gemini",
			InstallCommand: "npm install -g @google/gemini-cli",
			Description:    "Google Gemini terminal CLI.",
		},
		{
			ID:             "junie",
			Name:           "Junie",
			Model:          "JetBrains Junie",
			Command:        "junie",
			InstallCommand: "curl -fsSL https://junie.jetbrains.com/install.sh | bash",
			Description:    "JetBrains AI coding agent CLI.",
		},
	}
}

func (b *Backend) TerminalCount() int {
	return len(b.TerminalProfiles())
}
