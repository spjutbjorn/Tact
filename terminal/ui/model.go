package ui

import (
	"fmt"
	"strings"
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
	profiles []backend.TerminalProfile
	active   int
	response string
	width    int
	height   int
}

func NewModel() Model {
	b := backend.New()
	return Model{
		backend:  b,
		profiles: b.TerminalProfiles(),
	}
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
		if len(m.profiles) == 0 {
			switch msg.String() {
			case "q", "ctrl+c":
				return m, tea.Quit
			}
			return m, nil
		}
		switch msg.String() {
		case "left", "h":
			m.active = (m.active - 1 + len(m.profiles)) % len(m.profiles)
			m.response = fmt.Sprintf("active: %s", m.profiles[m.active].Name)
		case "right", "l":
			m.active = (m.active + 1) % len(m.profiles)
			m.response = fmt.Sprintf("active: %s", m.profiles[m.active].Name)
		case "1", "2", "3", "4", "5":
			index := int(msg.String()[0] - '1')
			if index < len(m.profiles) {
				m.active = index
				m.response = fmt.Sprintf("active: %s", m.profiles[m.active].Name)
			}
		case "enter":
			active := m.profiles[m.active]
			m.response = fmt.Sprintf("%s · %s · %s", active.Name, active.Model, active.Command)
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
	count := fmt.Sprintf("%d Bubble Tea terminals", len(m.profiles))
	help := "left/right switch  1-5 jump  enter details  p ping  q quit"
	body := title + "\n" + count + "\n" + help
	if len(m.profiles) > 0 {
		var rows []string
		for i, profile := range m.profiles {
			prefix := "  "
			if i == m.active {
				prefix = "> "
			}
			rows = append(rows, fmt.Sprintf("%s%s · %s · %s", prefix, profile.Name, profile.Model, profile.Command))
		}
		body += "\n\n" + strings.Join(rows, "\n")
	}
	if m.response != "" {
		body += "\n\n" + m.response
	}
	return body
}
