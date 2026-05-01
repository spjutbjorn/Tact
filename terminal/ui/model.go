package ui

import (
	"tact/internal/backend"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var titleStyle = lipgloss.NewStyle().
	Bold(true).
	Foreground(lipgloss.Color("#e8e8e8")).
	MarginBottom(1)

type Model struct {
	backend  *backend.Backend
	response string
	width    int
	height   int
}

func NewModel() Model {
	return Model{backend: backend.New()}
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case tea.KeyMsg:
		switch msg.String() {
		case "p":
			m.response = m.backend.Ping()
		case "q", "ctrl+c":
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m Model) View() string {
	title := titleStyle.Render("Tact")
	help := "p ping  q quit"
	body := title + "\n" + help
	if m.response != "" {
		body += "\n\n" + m.response
	}
	return body
}
