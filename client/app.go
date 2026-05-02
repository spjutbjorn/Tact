package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"tact/internal/backend"
	"time"
	"unicode/utf8"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type GitFileStatus struct {
	Path   string `json:"path"`
	Status string `json:"status"`
}

func (a *App) GitStatus() []GitFileStatus {
	trackedCmd := a.gitCommand("status", "--porcelain")
	trackedOut, err := trackedCmd.Output()
	if err != nil {
		return nil
	}

	var result []GitFileStatus
	for _, line := range strings.Split(string(trackedOut), "\n") {
		if len(line) < 3 {
			continue
		}
		if strings.HasPrefix(line, "?? ") {
			continue
		}
		status := line[:2]
		path := line[3:]
		result = append(result, GitFileStatus{Path: path, Status: status})
	}

	untrackedCmd := a.gitCommand("ls-files", "--others", "--exclude-standard")
	untrackedOut, err := untrackedCmd.Output()
	if err != nil {
		return result
	}

	for _, path := range strings.Split(string(untrackedOut), "\n") {
		if path == "" {
			continue
		}
		result = append(result, GitFileStatus{Path: path, Status: "??"})
	}

	return result
}

func (a *App) GitAdd(path string) bool {
	cmd := a.gitCommand("add", "--", path)
	return cmd.Run() == nil
}

func (a *App) GitUnstage(path string) bool {
	cmd := a.gitCommand("reset", "HEAD", "--", path)
	return cmd.Run() == nil
}

func (a *App) GitIgnore(path string) bool {
	f, err := os.OpenFile(".gitignore", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return false
	}
	defer f.Close()
	_, err = f.WriteString("\n" + path + "\n")
	return err == nil
}

func (a *App) GitLastCommitMessage() string {
	cmd := a.gitCommand("log", "-1", "--pretty=%B")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (a *App) GitCommit(message string, amend bool) bool {
	args := []string{"commit"}
	if amend {
		args = append(args, "--amend")
		if strings.TrimSpace(message) == "" {
			args = append(args, "--no-edit")
		} else {
			args = append(args, "-m", message)
		}
		return a.gitCommand(args...).Run() == nil
	}
	if strings.TrimSpace(message) == "" {
		return false
	}
	args = append(args, "-m", message)
	return a.gitCommand(args...).Run() == nil
}

func (a *App) GitPush() bool {
	return a.gitCommand("push").Run() == nil
}

func (a *App) GitLog() string {
	cmd := a.gitCommand(
		"log",
		"--graph",
		"--decorate=short",
		"--all",
		"-n",
		"100",
		"--color=never",
		"--date=short",
		"--pretty=format:%C(auto)%h %d%n    %s%n    %ad %an%n",
	)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(out)
}

func (a *App) GitBranchName() string {
	cmd := a.gitCommand("branch", "--show-current")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func (a *App) GitBranches() []string {
	cmd := a.gitCommand("branch", "--format=%(refname:short)")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	branches := make([]string, 0, len(lines))
	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}
		branches = append(branches, name)
	}
	sort.Strings(branches)
	return branches
}

func (a *App) GitCreateBranch(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	return a.gitCommand("checkout", "-b", name).Run() == nil
}

func (a *App) GitCheckoutBranch(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	return a.gitCommand("checkout", name).Run() == nil
}

func (a *App) GitRevert(path string) bool {
	restore := a.gitCommand("restore", "--source=HEAD", "--staged", "--worktree", "--", path)
	restoreErr := restore.Run()

	clean := a.gitCommand("clean", "-fd", "--", path)
	cleanErr := clean.Run()

	return restoreErr == nil || cleanErr == nil
}

func (a *App) GitDiff(path string) string {
	cmd := a.gitCommand("diff", "HEAD", "--", path)
	out, err := cmd.Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		cmd = a.gitCommand("diff", "--", path)
		out, err = cmd.Output()
		if err != nil {
			return ""
		}
	}
	return string(out)
}

func (a *App) DeleteFile(path string) bool {
	if path == "" || strings.Contains(path, "::") {
		if archivePath, innerPath, ok := splitVirtualZipPath(path); ok {
			return deleteZipEntry(archivePath, innerPath)
		}
		return false
	}

	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	if info.IsDir() {
		return os.RemoveAll(path) == nil
	}
	return os.Remove(path) == nil
}

func (a *App) CopyPath(sourcePath, destinationDir string) bool {
	if sourcePath == "" || destinationDir == "" || strings.Contains(destinationDir, "::") {
		return false
	}

	info, err := os.Stat(destinationDir)
	if err != nil || !info.IsDir() {
		return false
	}

	targetPath := filepath.Join(destinationDir, copyBaseName(sourcePath))
	return copyPathRecursive(a, sourcePath, targetPath)
}

func (a *App) MovePath(sourcePath, destinationDir string) bool {
	if sourcePath == "" || destinationDir == "" || strings.Contains(destinationDir, "::") {
		return false
	}

	info, err := os.Stat(destinationDir)
	if err != nil || !info.IsDir() {
		return false
	}

	targetPath := filepath.Join(destinationDir, copyBaseName(sourcePath))

	if archivePath, innerPath, ok := splitVirtualZipPath(sourcePath); ok {
		if archivePath == "" || innerPath == "" {
			return false
		}
		if !copyPathRecursive(a, sourcePath, targetPath) {
			return false
		}
		return deleteZipEntry(archivePath, innerPath)
	}

	if err := os.Rename(sourcePath, targetPath); err == nil {
		return true
	}

	if !copyPathRecursive(a, sourcePath, targetPath) {
		return false
	}
	if info, err := os.Stat(sourcePath); err == nil && info.IsDir() {
		return os.RemoveAll(sourcePath) == nil
	}
	return os.Remove(sourcePath) == nil
}

func copyBaseName(path string) string {
	if archivePath, innerPath, ok := splitVirtualZipPath(path); ok {
		if innerPath == "" {
			return filepath.Base(archivePath)
		}
		return filepath.Base(innerPath)
	}
	return filepath.Base(path)
}

func joinCopyPath(parent, child string) string {
	if strings.HasSuffix(parent, "::") {
		return parent + child
	}
	if strings.Contains(parent, "::") {
		return parent + "/" + child
	}
	return filepath.Join(parent, child)
}

func copyPathRecursive(a *App, sourcePath, targetPath string) bool {
	if data, ok := readPathBytes(sourcePath); ok {
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return false
		}
		return os.WriteFile(targetPath, data, 0644) == nil
	}

	if archivePath, innerPath, ok := splitVirtualZipPath(sourcePath); ok {
		if archivePath == "" || innerPath == "" {
			return false
		}
		children := a.ListDir(sourcePath)
		if err := os.MkdirAll(targetPath, 0755); err != nil {
			return false
		}
		for _, child := range children {
			childSource := joinCopyPath(sourcePath, child.Name)
			childTarget := filepath.Join(targetPath, child.Name)
			if !copyPathRecursive(a, childSource, childTarget) {
				return false
			}
		}
		return true
	}

	info, err := os.Stat(sourcePath)
	if err != nil {
		return false
	}
	if info.IsDir() {
		if err := os.MkdirAll(targetPath, 0755); err != nil {
			return false
		}
		entries, err := os.ReadDir(sourcePath)
		if err != nil {
			return false
		}
		for _, entry := range entries {
			childSource := filepath.Join(sourcePath, entry.Name())
			childTarget := filepath.Join(targetPath, entry.Name())
			if !copyPathRecursive(a, childSource, childTarget) {
				return false
			}
		}
		return true
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		return false
	}
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return false
	}
	return os.WriteFile(targetPath, data, 0644) == nil
}

func deleteZipEntry(archivePath, innerPath string) bool {
	if archivePath == "" || innerPath == "" {
		return false
	}

	data, err := os.ReadFile(archivePath)
	if err != nil {
		return false
	}

	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return false
	}

	tempFile, err := os.CreateTemp(filepath.Dir(archivePath), filepath.Base(archivePath)+".delete-*.zip")
	if err != nil {
		return false
	}
	defer os.Remove(tempFile.Name())

	writer := zip.NewWriter(tempFile)
	deleted := false

	for _, file := range reader.File {
		name := strings.TrimSuffix(file.Name, "/")
		if name == innerPath || strings.HasPrefix(name, innerPath+"/") {
			deleted = true
			continue
		}

		header := file.FileHeader
		header.Name = file.Name
		header.Method = file.Method

		if file.FileInfo().IsDir() {
			if _, err := writer.CreateHeader(&header); err != nil {
				writer.Close()
				tempFile.Close()
				return false
			}
			continue
		}

		dst, err := writer.CreateHeader(&header)
		if err != nil {
			writer.Close()
			tempFile.Close()
			return false
		}

		src, err := file.Open()
		if err != nil {
			writer.Close()
			tempFile.Close()
			return false
		}

		if _, err := io.Copy(dst, src); err != nil {
			src.Close()
			writer.Close()
			tempFile.Close()
			return false
		}
		src.Close()
	}

	if !deleted {
		writer.Close()
		tempFile.Close()
		return false
	}

	if err := writer.Close(); err != nil {
		tempFile.Close()
		return false
	}
	if err := tempFile.Close(); err != nil {
		return false
	}

	if err := os.Rename(tempFile.Name(), archivePath); err != nil {
		return false
	}

	return true
}

type VolumeInfo struct {
	Path string `json:"path"`
	Name string `json:"name"`
}

type TerminalSessionInfo struct {
	ID        string `json:"id"`
	ProfileID string `json:"profileId"`
	Name      string `json:"name"`
	Model     string `json:"model"`
	Command   string `json:"command"`
	Running   bool   `json:"running"`
	StartedAt string `json:"startedAt"`
}

type terminalSession struct {
	info     TerminalSessionInfo
	cmd      *exec.Cmd
	pty      *os.File
	profile  backend.TerminalProfile
	startDir string
}

type App struct {
	ctx               context.Context
	backend           *backend.Backend
	terminalMu        sync.Mutex
	terminalSessions  map[string]*terminalSession
	terminalLaunchSeq int
}

type FileEntry struct {
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

func NewApp() *App {
	return &App{
		backend:          backend.New(),
		terminalSessions: map[string]*terminalSession{},
	}
}

func (a *App) gitRoot() string {
	cwd := a.GetCwd()
	cmd := exec.Command("git", "rev-parse", "--show-toplevel")
	cmd.Dir = cwd
	out, err := cmd.Output()
	if err != nil {
		return cwd
	}
	root := strings.TrimSpace(string(out))
	if root == "" {
		return cwd
	}
	return root
}

func (a *App) gitCommand(args ...string) *exec.Cmd {
	cmd := exec.Command("git", args...)
	cmd.Dir = a.gitRoot()
	return cmd
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) Ping() string {
	return a.backend.Ping()
}

func (a *App) TerminalProfiles() []backend.TerminalProfile {
	return a.backend.TerminalProfiles()
}

func (a *App) TerminalProfileUsage(profileID string) string {
	probe, ok := terminalUsageProbeForProfile(profileID)
	if !ok {
		return ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, probe.command, probe.args...)
	if cwd := a.GetCwd(); cwd != "" {
		cmd.Dir = cwd
	}
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return ""
	}

	var output bytes.Buffer
	readDone := make(chan struct{})
	go func() {
		_, _ = io.Copy(&output, ptmx)
		close(readDone)
	}()

	waitDone := make(chan error, 1)
	go func() {
		waitDone <- cmd.Wait()
	}()

	if probe.input != "" {
		_, _ = io.WriteString(ptmx, probe.input)
	}

	time.Sleep(700 * time.Millisecond)
	_ = ptmx.Close()

	select {
	case <-readDone:
	case <-time.After(2 * time.Second):
	}

	select {
	case <-waitDone:
	case <-time.After(2 * time.Second):
	}

	return summarizeUsageOutput(stripANSI(output.String()))
}

func (a *App) TerminalCount() int {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()
	return len(a.terminalSessions)
}

func (a *App) TerminalSessions() []TerminalSessionInfo {
	a.terminalMu.Lock()
	defer a.terminalMu.Unlock()

	result := make([]TerminalSessionInfo, 0, len(a.terminalSessions))
	for _, session := range a.terminalSessions {
		result = append(result, session.info)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].StartedAt == result[j].StartedAt {
			return result[i].Name < result[j].Name
		}
		return result[i].StartedAt > result[j].StartedAt
	})
	return result
}

func (a *App) LaunchTerminalProfile(id string) string {
	return a.LaunchTerminalProfileAt(id, "")
}

func (a *App) LaunchTerminalProfileAt(id string, dir string) string {
	profile, ok := a.terminalProfileByID(id)
	if !ok {
		return ""
	}
	if !a.ensureTerminalProfileInstalled(profile) {
		return ""
	}
	session := a.spawnTerminalSession(profile, dir)
	if session == nil {
		return ""
	}
	return session.info.ID
}

// Kept for binding compatibility; the size parameters are ignored — the actual
// PTY is sized by the first ResizeTerminalSession call from the frontend.
func (a *App) LaunchTerminalProfileAtSized(id string, dir string, _ int, _ int) string {
	return a.LaunchTerminalProfileAt(id, dir)
}

func (a *App) SendTerminalInput(sessionID, input string) bool {
	a.terminalMu.Lock()
	session := a.terminalSessions[sessionID]
	a.terminalMu.Unlock()
	if session == nil || session.pty == nil {
		return false
	}
	_, err := io.WriteString(session.pty, input)
	return err == nil
}

func (a *App) CloseTerminalSession(sessionID string) bool {
	a.terminalMu.Lock()
	session := a.terminalSessions[sessionID]
	a.terminalMu.Unlock()
	if session == nil {
		return false
	}
	if session.pty != nil {
		_ = session.pty.Close()
	}
	if session.cmd != nil && session.cmd.Process != nil {
		_ = session.cmd.Process.Kill()
	}
	a.terminalMu.Lock()
	delete(a.terminalSessions, sessionID)
	a.terminalMu.Unlock()
	a.emitTerminalSessions()
	return true
}

func (a *App) RenameTerminalSession(sessionID, name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}

	a.terminalMu.Lock()
	session := a.terminalSessions[sessionID]
	if session == nil {
		a.terminalMu.Unlock()
		return false
	}
	session.info.Name = name
	a.terminalMu.Unlock()
	a.emitTerminalSessions()
	return true
}

func (a *App) ResizeTerminalSession(sessionID string, cols, rows int) bool {
	if cols <= 0 || rows <= 0 {
		return false
	}
	a.terminalMu.Lock()
	session := a.terminalSessions[sessionID]
	a.terminalMu.Unlock()
	if session == nil {
		return false
	}
	if session.pty == nil && session.cmd == nil {
		return a.startTerminalProcess(session, cols, rows)
	}
	if session.pty == nil {
		return false
	}
	return pty.Setsize(session.pty, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)}) == nil
}

func (a *App) terminalProfileByID(id string) (backend.TerminalProfile, bool) {
	for _, profile := range a.backend.TerminalProfiles() {
		if profile.ID == id {
			return profile, true
		}
	}
	return backend.TerminalProfile{}, false
}

func profileExecutable(command string) string {
	fields := strings.Fields(command)
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

func shellForCommand() string {
	shell := os.Getenv("SHELL")
	if shell == "" {
		return "/bin/zsh"
	}
	return shell
}

func (a *App) commandAvailable(command string) bool {
	if command == "" {
		return false
	}
	shell := shellForCommand()
	check := exec.Command(shell, "-ilc", fmt.Sprintf("command -v %s >/dev/null 2>&1", shellEscape(command)))
	check.Env = os.Environ()
	return check.Run() == nil
}

func (a *App) runShellCommand(command string) bool {
	if strings.TrimSpace(command) == "" {
		return false
	}
	shell := shellForCommand()
	cmd := exec.Command(shell, "-ilc", command)
	cmd.Env = os.Environ()
	return cmd.Run() == nil
}

func (a *App) ensureTerminalProfileInstalled(profile backend.TerminalProfile) bool {
	executable := profileExecutable(profile.Command)
	if executable == "" || a.commandAvailable(executable) {
		return true
	}
	if strings.TrimSpace(profile.InstallCommand) == "" {
		return false
	}
	if !a.runShellCommand(profile.InstallCommand) {
		return false
	}
	return a.commandAvailable(executable)
}

func (a *App) spawnTerminalSession(profile backend.TerminalProfile, dir string) *terminalSession {
	startDir := dir
	if startDir == "" {
		startDir = a.GetCwd()
	}
	if info, err := os.Stat(startDir); err != nil || !info.IsDir() {
		startDir = a.GetCwd()
	}

	a.terminalMu.Lock()
	a.terminalLaunchSeq++
	index := a.terminalLaunchSeq
	a.terminalMu.Unlock()

	sessionID := fmt.Sprintf("%s-%d", profile.ID, index)
	sessionName := fmt.Sprintf("%s #%d", profile.Name, index)

	session := &terminalSession{
		info: TerminalSessionInfo{
			ID:        sessionID,
			ProfileID: profile.ID,
			Name:      sessionName,
			Model:     profile.Model,
			Command:   profile.Command,
			Running:   true,
			StartedAt: time.Now().Format(time.RFC3339Nano),
		},
		profile:  profile,
		startDir: startDir,
	}

	a.terminalMu.Lock()
	a.terminalSessions[sessionID] = session
	a.terminalMu.Unlock()
	a.emitTerminalSessions()

	return session
}

// Starts the actual PTY + child process. Called lazily by the first
// ResizeTerminalSession so that the process inherits the real terminal
// dimensions reported by the frontend's xterm fit, avoiding a visible
// reflow on initial render.
func (a *App) startTerminalProcess(session *terminalSession, cols, rows int) bool {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/zsh"
	}
	// -i so the shell sources .zshrc/.bashrc and shell aliases (e.g. copilot → gh copilot -i chat) expand.
	// No `exec` wrapper: per zsh docs, `exec` requires a real binary and bypasses alias/function lookup,
	// so wrapping with `exec <cmd>` would fail for aliased commands. The extra shell process is fine —
	// closing the PTY sends SIGHUP through the foreground process group on session close.
	cmd := exec.Command(shell, "-ilc", fmt.Sprintf("cd %s && %s", shellEscape(session.startDir), session.profile.Command))
	cmd.Dir = session.startDir
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", "COLORTERM=truecolor")
	if session.profile.ID == "gemini" {
		if homeDir, err := prepareGeminiHome(); err == nil {
			cmd.Env = append(cmd.Env,
				"HOME="+homeDir,
				"XDG_CONFIG_HOME="+homeDir,
			)
		}
	}

	ptyFile, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: uint16(cols), Rows: uint16(rows)})
	if err != nil {
		return false
	}

	a.terminalMu.Lock()
	session.cmd = cmd
	session.pty = ptyFile
	a.terminalMu.Unlock()

	sessionID := session.info.ID
	go a.pipeTerminalOutput(sessionID, ptyFile)

	go func() {
		_ = cmd.Wait()
		a.terminalMu.Lock()
		if current := a.terminalSessions[sessionID]; current != nil {
			current.info.Running = false
			current.pty = nil
		}
		a.terminalMu.Unlock()
		a.emitTerminalSessions()
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "terminal:exited", sessionID)
		}
	}()

	return true
}

func (a *App) emitTerminalSessions() {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, "terminal:sessions")
}

type terminalUsageProbe struct {
	command string
	args    []string
	input   string
}

func terminalUsageProbeForProfile(profileID string) (terminalUsageProbe, bool) {
	switch profileID {
	case "codex":
		return terminalUsageProbe{command: "codex", input: "/status\n"}, true
	case "copilot":
		return terminalUsageProbe{command: "copilot", input: "/usage\n"}, true
	case "claude":
		return terminalUsageProbe{command: "claude", input: "/usage\n"}, true
	case "gemini":
		return terminalUsageProbe{command: "gemini", input: "/stats model\n"}, true
	case "junie":
		return terminalUsageProbe{command: "junie", input: "/usage\n"}, true
	default:
		return terminalUsageProbe{}, false
	}
}

func stripANSI(value string) string {
	ansi := regexp.MustCompile(`\x1b\[[0-?]*[ -/]*[@-~]`)
	return ansi.ReplaceAllString(value, "")
}

func summarizeUsageOutput(output string) string {
	lines := strings.Split(output, "\n")
	candidates := make([]string, 0, 4)
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		if lower == "usage" || lower == "användning" {
			continue
		}
		if strings.Contains(lower, "limit") || strings.Contains(lower, "quota") || strings.Contains(lower, "token") || strings.Contains(lower, "usage") || strings.Contains(lower, "context") || strings.Contains(lower, "resets") || strings.Contains(lower, "remaining") || strings.Contains(lower, "cost") {
			normalized := normalizeUsageLine(line)
			if normalized != "" {
				candidates = append(candidates, normalized)
			}
		}
	}
	if len(candidates) == 0 {
		return ""
	}
	if len(candidates) > 2 {
		candidates = candidates[:2]
	}
	return strings.Join(candidates, "\n")
}

func normalizeUsageLine(line string) string {
	replacements := []struct {
		pattern *regexp.Regexp
		replace string
	}{
		{regexp.MustCompile(`(?i)\b([0-9]+(?:\.[0-9]+)?)%\s*left\b`), "$1% kvar"},
		{regexp.MustCompile(`(?i)\b([0-9]+(?:\.[0-9]+)?)%\s*used\b`), "$1% använt"},
		{regexp.MustCompile(`(?i)\bresets\b`), "återställs"},
		{regexp.MustCompile(`(?i)\bremaining\b`), "kvar"},
		{regexp.MustCompile(`(?i)^\s*(usage|användning)\s*:?\s*`), ""},
	}
	out := line
	for _, repl := range replacements {
		out = repl.pattern.ReplaceAllString(out, repl.replace)
	}
	return strings.TrimSpace(out)
}

func (a *App) pipeTerminalOutput(sessionID string, reader io.ReadCloser) {
	defer reader.Close()
	buf := make([]byte, 4096)
	var leftover []byte
	for {
		n, err := reader.Read(buf)
		if n > 0 && a.ctx != nil {
			data := append(leftover, buf[:n]...)
			valid, rest := splitValidUTF8(data)
			if len(valid) > 0 {
				runtime.EventsEmit(a.ctx, "terminal:output", sessionID, string(valid))
			}
			leftover = rest
		}
		if err != nil {
			if len(leftover) > 0 && a.ctx != nil {
				runtime.EventsEmit(a.ctx, "terminal:output", sessionID, string(leftover))
			}
			return
		}
	}
}

func splitValidUTF8(b []byte) (valid, rest []byte) {
	if utf8.Valid(b) {
		return b, nil
	}
	// Work backwards from the end to find the last byte that starts a rune.
	for i := len(b) - 1; i >= 0 && i >= len(b)-4; i-- {
		if utf8.RuneStart(b[i]) {
			// Check if the rune starting at i is complete.
			if utf8.FullRune(b[i:]) {
				return b, nil
			}
			return b[:i], b[i:]
		}
	}
	return b, nil
}

func shellEscape(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func prepareGeminiHome() (string, error) {
	sourceHome := filepath.Join(os.Getenv("HOME"), ".gemini")
	tempHome, err := os.MkdirTemp("", "tact-gemini-home-*")
	if err != nil {
		return "", err
	}
	destHome := filepath.Join(tempHome, ".gemini")
	if err := copyDir(sourceHome, destHome); err != nil {
		return "", err
	}
	settingsPath := filepath.Join(destHome, "settings.json")
	settings := map[string]any{}
	if data, err := os.ReadFile(settingsPath); err == nil && len(data) > 0 {
		_ = json.Unmarshal(data, &settings)
	}
	general, _ := settings["general"].(map[string]any)
	if general == nil {
		general = map[string]any{}
		settings["general"] = general
	}
	general["enableAutoUpdate"] = false
	general["enableAutoUpdateNotification"] = false
	general["enableNotifications"] = false
	mcp, _ := settings["mcp"].(map[string]any)
	if mcp == nil {
		mcp = map[string]any{}
		settings["mcp"] = mcp
	}
	mcp["allowed"] = []string{}
	encoded, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(settingsPath, encoded, 0644); err != nil {
		return "", err
	}
	return tempHome, nil
}

func copyDir(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		if os.IsNotExist(err) {
			return os.MkdirAll(dst, 0755)
		}
		return err
	}
	if !info.IsDir() {
		return fmt.Errorf("%s is not a directory", src)
	}
	if err := os.MkdirAll(dst, info.Mode().Perm()); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		if err := copyFile(srcPath, dstPath); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, info.Mode().Perm())
}

func (a *App) GetCwd() string {
	path, err := os.Getwd()
	if err != nil {
		return "/"
	}
	return path
}

func (a *App) Navigate(path string) string {
	if archivePath, _, ok := splitVirtualZipPath(path); ok {
		if _, err := os.Stat(archivePath); err == nil {
			return path
		}
		return ""
	}
	info, err := os.Stat(path)
	if err != nil || !info.IsDir() {
		return ""
	}
	return path
}

func splitVirtualZipPath(path string) (string, string, bool) {
	idx := strings.Index(path, "::")
	if idx == -1 {
		return "", "", false
	}
	archivePath := path[:idx]
	innerPath := strings.TrimPrefix(path[idx+2:], "/")
	return archivePath, innerPath, true
}

func readPathBytes(path string) ([]byte, bool) {
	if archivePath, innerPath, ok := splitVirtualZipPath(path); ok {
		data, err := os.ReadFile(archivePath)
		if err != nil {
			return nil, false
		}
		reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			return nil, false
		}
		for _, f := range reader.File {
			if strings.TrimSuffix(f.Name, "/") != innerPath {
				continue
			}
			rc, err := f.Open()
			if err != nil {
				return nil, false
			}
			defer rc.Close()
			out, err := io.ReadAll(rc)
			if err != nil {
				return nil, false
			}
			return out, true
		}
		return nil, false
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, false
	}
	return data, true
}

func (a *App) ReadTextFile(path string) string {
	data, ok := readPathBytes(path)
	if !ok {
		return ""
	}
	return string(data)
}

func (a *App) ReadDocxFile(path string) string {
	data, ok := readPathBytes(path)
	if !ok {
		return ""
	}

	temp, err := os.CreateTemp("", "tact-docx-*.docx")
	if err == nil {
		tempPath := temp.Name()
		_, writeErr := temp.Write(data)
		closeErr := temp.Close()
		if writeErr == nil && closeErr == nil {
			defer os.Remove(tempPath)
			cmd := exec.Command(
				"pandoc",
				tempPath,
				"-f", "docx",
				"-t", "html",
				"--wrap=none",
				"--embed-resources",
				"--standalone",
			)
			if out, err := cmd.Output(); err == nil && len(out) > 0 {
				return string(out)
			}
		} else {
			_ = os.Remove(tempPath)
		}
	}

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ""
	}
	var doc *zip.File
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			doc = f
			break
		}
	}
	if doc == nil {
		return ""
	}

	rc, err := doc.Open()
	if err != nil {
		return ""
	}
	defer rc.Close()

	docData, err := io.ReadAll(rc)
	if err != nil {
		return ""
	}

	decoder := xml.NewDecoder(bytes.NewReader(docData))
	var blocks []string
	var paragraph strings.Builder
	var cell strings.Builder
	var row []string
	inText := false
	inCell := false
	inParagraph := false

	flushParagraph := func() {
		text := strings.TrimSpace(paragraph.String())
		paragraph.Reset()
		if text == "" {
			if inCell {
				if cell.Len() > 0 && !strings.HasSuffix(cell.String(), "\n\n") {
					cell.WriteString("\n\n")
				}
			} else if len(blocks) > 0 && blocks[len(blocks)-1] != "" {
				blocks = append(blocks, "")
			}
			return
		}
		if inCell {
			if cell.Len() > 0 && !strings.HasSuffix(cell.String(), "\n") {
				cell.WriteString("\n")
			}
			cell.WriteString(text)
		} else {
			blocks = append(blocks, text)
		}
	}

	flushCell := func() {
		flushParagraph()
		text := strings.TrimSpace(cell.String())
		cell.Reset()
		if text == "" {
			row = append(row, "")
			return
		}
		row = append(row, text)
	}

	flushRow := func() {
		if len(row) == 0 {
			return
		}
		for len(row) > 0 && row[len(row)-1] == "" {
			row = row[:len(row)-1]
		}
		if len(row) == 0 {
			return
		}
		blocks = append(blocks, strings.Join(row, "\t"))
		row = nil
	}

	for {
		tok, err := decoder.Token()
		if err != nil {
			if err == io.EOF {
				break
			}
			return ""
		}

		switch el := tok.(type) {
		case xml.StartElement:
			switch el.Name.Local {
			case "p":
				if inParagraph {
					flushParagraph()
				}
				inParagraph = true
				paragraph.Reset()
				inText = false
			case "t":
				inText = true
			case "tab":
				if inText {
					if inParagraph {
						paragraph.WriteString("\t")
					} else if inCell {
						cell.WriteString("\t")
					}
				}
			case "br", "cr":
				if inText {
					if inParagraph {
						paragraph.WriteString("\n")
					} else if inCell {
						cell.WriteString("\n")
					}
				}
			case "tc":
				inCell = true
				cell.Reset()
			case "tr":
				row = nil
			}
		case xml.EndElement:
			switch el.Name.Local {
			case "t":
				inText = false
			case "p":
				if inParagraph {
					flushParagraph()
					inParagraph = false
				}
			case "tc":
				flushCell()
				inCell = false
			case "tr":
				flushRow()
			}
		case xml.CharData:
			if !inText {
				continue
			}
			text := string([]byte(el))
			if inParagraph {
				paragraph.WriteString(text)
			} else if inCell {
				cell.WriteString(text)
			}
		}
	}

	flushParagraph()
	flushRow()

	var out strings.Builder
	out.WriteString(`<div class="docx-doc">`)
	inTable := false
	flushTable := func() {
		if inTable {
			out.WriteString(`</tbody></table>`)
			inTable = false
		}
	}
	for _, block := range blocks {
		text := strings.TrimSpace(block)
		if text == "" {
			flushTable()
			continue
		}
		if strings.Contains(block, "\t") {
			cells := strings.Split(block, "\t")
			if !inTable {
				out.WriteString(`<table class="docx-table"><tbody>`)
				inTable = true
			}
			out.WriteString("<tr>")
			for _, cell := range cells {
				out.WriteString("<td>")
				out.WriteString(html.EscapeString(strings.TrimSpace(cell)))
				out.WriteString("</td>")
			}
			out.WriteString("</tr>")
			continue
		}
		flushTable()
		out.WriteString("<p>")
		out.WriteString(html.EscapeString(text))
		out.WriteString("</p>")
	}
	flushTable()
	out.WriteString(`</div>`)
	return out.String()
}

func (a *App) ReadPandocHtml(path string) string {
	data, ok := readPathBytes(path)
	if !ok {
		return ""
	}

	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(path)), ".")
	if ext != "epub" && ext != "rtf" {
		return ""
	}

	temp, err := os.CreateTemp("", "tact-rich-*."+ext)
	if err != nil {
		return ""
	}
	tempPath := temp.Name()
	if _, writeErr := temp.Write(data); writeErr != nil {
		_ = temp.Close()
		_ = os.Remove(tempPath)
		return ""
	}
	if closeErr := temp.Close(); closeErr != nil {
		_ = os.Remove(tempPath)
		return ""
	}
	defer os.Remove(tempPath)

	cmd := exec.Command(
		"pandoc",
		tempPath,
		"-f", ext,
		"-t", "html",
		"--wrap=none",
		"--standalone",
		"--embed-resources",
	)
	out, err := cmd.Output()
	if err != nil || len(out) == 0 {
		return ""
	}
	return string(out)
}

func (a *App) WriteTextFile(path string, content string) bool {
	return os.WriteFile(path, []byte(content), 0644) == nil
}

func (a *App) ReadBinaryFile(path string) string {
	data, ok := readPathBytes(path)
	if !ok {
		return ""
	}
	return base64.StdEncoding.EncodeToString(data)
}

func (a *App) PrepareVideoPath(path string) string {
	if !strings.EqualFold(filepath.Ext(path), ".mkv") {
		return path
	}

	info, err := os.Stat(path)
	if err != nil {
		return ""
	}

	cacheDir := filepath.Join(os.TempDir(), "tact-video-cache")
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return ""
	}

	stamp := info.ModTime().UTC().Format(time.RFC3339Nano)
	outPath := filepath.Join(cacheDir, strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))+"-"+stamp+".mp4")
	if cachedInfo, err := os.Stat(outPath); err == nil && cachedInfo.Size() > 0 {
		return outPath
	}

	cmd := exec.Command(
		"ffmpeg",
		"-y",
		"-i", path,
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "23",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac",
		"-movflags", "+faststart",
		outPath,
	)
	if err := cmd.Run(); err != nil {
		return ""
	}
	return outPath
}

func (a *App) Rename(oldPath, newPath string) bool {
	return os.Rename(oldPath, newPath) == nil
}

func (a *App) ListDir(path string) []FileEntry {
	if archivePath, innerPath, ok := splitVirtualZipPath(path); ok {
		data, err := os.ReadFile(archivePath)
		if err != nil {
			return nil
		}
		zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			return nil
		}

		prefix := innerPath
		if prefix != "" && !strings.HasSuffix(prefix, "/") {
			prefix += "/"
		}

		children := map[string]bool{}
		for _, f := range zr.File {
			name := strings.TrimSuffix(f.Name, "/")
			if !strings.HasPrefix(name, prefix) {
				continue
			}
			rest := strings.TrimPrefix(name, prefix)
			if rest == "" {
				continue
			}
			parts := strings.Split(rest, "/")
			child := parts[0]
			isDir := len(parts) > 1 || strings.HasSuffix(f.Name, "/")
			if existing, ok := children[child]; ok {
				children[child] = existing || isDir
			} else {
				children[child] = isDir
			}
		}

		result := make([]FileEntry, 0, len(children))
		for name, isDir := range children {
			size := int64(0)
			if !isDir {
				for _, f := range zr.File {
					if strings.TrimSuffix(f.Name, "/") == prefix+name {
						size = int64(f.UncompressedSize64)
						break
					}
				}
			}
			result = append(result, FileEntry{Name: name, IsDir: isDir, Size: size})
		}
		sort.Slice(result, func(i, j int) bool {
			if result[i].IsDir != result[j].IsDir {
				return result[i].IsDir
			}
			return result[i].Name < result[j].Name
		})
		return result
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil
	}
	result := make([]FileEntry, 0, len(entries))
	for _, e := range entries {
		size := int64(0)
		if !e.IsDir() {
			if info, err := e.Info(); err == nil {
				size = info.Size()
			}
		}
		result = append(result, FileEntry{Name: e.Name(), IsDir: e.IsDir(), Size: size})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir
		}
		return result[i].Name < result[j].Name
	})
	return result
}

func (a *App) DirSize(path string) int64 {
	if archivePath, innerPath, ok := splitVirtualZipPath(path); ok {
		data, err := os.ReadFile(archivePath)
		if err != nil {
			return 0
		}
		zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
		if err != nil {
			return 0
		}

		prefix := innerPath
		if prefix != "" && !strings.HasSuffix(prefix, "/") {
			prefix += "/"
		}

		var total int64
		for _, f := range zr.File {
			name := strings.TrimSuffix(f.Name, "/")
			if !strings.HasPrefix(name, prefix) || f.FileInfo().IsDir() {
				continue
			}
			total += int64(f.UncompressedSize64)
		}
		return total
	}

	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	if !info.IsDir() {
		return info.Size()
	}

	var total int64
	_ = filepath.WalkDir(path, func(walkPath string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		fileInfo, err := d.Info()
		if err != nil {
			return nil
		}
		total += fileInfo.Size()
		return nil
	})
	return total
}
