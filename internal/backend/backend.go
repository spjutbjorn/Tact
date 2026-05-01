package backend

// Backend is the core business logic shared by the Wails client and terminal.
type Backend struct{}

func New() *Backend {
	return &Backend{}
}

func (b *Backend) Ping() string {
	return "pong"
}
