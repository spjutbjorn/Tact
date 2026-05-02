package main

import (
	"context"
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/xml"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"tact/internal/backend"
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

func (a *App) GitRevert(path string) bool {
	restore := a.gitCommand("restore", "--source=HEAD", "--staged", "--worktree", "--", path)
	restoreErr := restore.Run()

	clean := a.gitCommand("clean", "-fd", "--", path)
	cleanErr := clean.Run()

	return restoreErr == nil || cleanErr == nil
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

type App struct {
	ctx     context.Context
	backend *backend.Backend
}

type FileEntry struct {
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

func NewApp() *App {
	return &App{backend: backend.New()}
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

	return strings.TrimSpace(strings.Join(blocks, "\n\n"))
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
