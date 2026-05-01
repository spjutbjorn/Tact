//go:build !darwin

package main

import "os"

func (a *App) ListVolumes() []VolumeInfo {
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "local"
	}
	vols := []VolumeInfo{{Path: "/", Name: "local (" + hostname + ")"}}
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
