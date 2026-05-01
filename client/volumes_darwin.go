//go:build darwin

package main

import (
	"os"
	"os/exec"
	"strings"

	"golang.org/x/sys/unix"
)

func (a *App) ListVolumes() []VolumeInfo {
	rootName := diskutilVolumeName("/")
	if rootName == "" {
		rootName, _ = os.Hostname()
	}
	if rootName == "" {
		rootName = "local"
	}

	mnt := make([]unix.Statfs_t, 128)
	n, err := unix.Getfsstat(mnt, 1 /* MNT_WAIT */)
	if err != nil || n == 0 {
		return fallbackVolumes(rootName)
	}
	mnt = mnt[:n]

	skip := map[string]bool{
		"devfs":   true,
		"autofs":  true,
		"synthfs": true,
	}

	// Skip mounts that are clearly system-internal and not user-navigable.
	systemPrefixes := []string{
		"/System/",
		"/private/",
		"/dev/",
		"/net/",
		"/home/",
	}

	seen := map[string]bool{}
	var volumes []VolumeInfo
	for _, s := range mnt {
		fstype := unix.ByteSliceToString(s.Fstypename[:])
		if skip[fstype] {
			continue
		}
		mountpoint := unix.ByteSliceToString(s.Mntonname[:])
		isSystem := false
		for _, prefix := range systemPrefixes {
			if strings.HasPrefix(mountpoint, prefix) {
				isSystem = true
				break
			}
		}
		if isSystem {
			continue
		}
		if seen[mountpoint] {
			continue
		}
		seen[mountpoint] = true

		name := rootName
		if mountpoint != "/" {
			parts := strings.Split(mountpoint, "/")
			name = parts[len(parts)-1]
		}
		volumes = append(volumes, VolumeInfo{Path: mountpoint, Name: name})
	}
	return volumes
}

// diskutilVolumeName runs "diskutil info <path>" and returns the Volume Name field.
func diskutilVolumeName(path string) string {
	out, err := exec.Command("diskutil", "info", path).Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Volume Name:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "Volume Name:"))
		}
	}
	return ""
}

func fallbackVolumes(rootName string) []VolumeInfo {
	vols := []VolumeInfo{{Path: "/", Name: rootName}}
	entries, err := os.ReadDir("/Volumes")
	if err != nil {
		return vols
	}
	for _, e := range entries {
		if e.IsDir() {
			vols = append(vols, VolumeInfo{
				Path: "/Volumes/" + e.Name(),
				Name: e.Name(),
			})
		}
	}
	return vols
}
