package internal

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Logger struct {
	file   *os.File
	Logger *slog.Logger
}

type prettyHandler struct {
	file   *os.File
	level  slog.Level
	source bool
}

func (h *prettyHandler) Enabled(_ context.Context, level slog.Level) bool {
	return level >= h.level
}

func (h *prettyHandler) Handle(_ context.Context, r slog.Record) error {
	level := fmt.Sprintf("%-5s", r.Level.String())
	var source string
	if h.source && r.PC != 0 {
		frames := runtime.CallersFrames([]uintptr{r.PC})
		f, _ := frames.Next()
		source = fmt.Sprintf(" (%s:%d)", filepath.Base(f.File), f.Line)
	}
	timestamp := r.Time.Format("2006/01/02 15:04:05")
	var attrs strings.Builder
	r.Attrs(func(a slog.Attr) bool {
		fmt.Fprintf(&attrs, " %s=%v", a.Key, a.Value)
		return true
	})
	line := fmt.Sprintf("%s %s %s%s%s\n",
		timestamp,
		level,
		r.Message,
		attrs.String(),
		source,
	)

	// Always write to file — this must never be skipped
	if h.file != nil {
		h.file.WriteString(line)
	}

	// Best-effort write to stdout; ignore errors (stdout may not exist in GUI builds)
	fmt.Fprint(os.Stdout, line)

	return nil
}

func (h *prettyHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return h
}

func (h *prettyHandler) WithGroup(name string) slog.Handler {
	return h
}

func NewLogger(appDataDir string) (*Logger, error) {
	logPath := filepath.Join(appDataDir, "logs.txt")
	oldLogPath := filepath.Join(appDataDir, "logs.old.txt")

	if info, err := os.Stat(logPath); err == nil && info.Size() > 10*1024*1024 {
		if err := os.Rename(logPath, oldLogPath); err != nil {
			// can't use slog here yet, just ignore
		}
	}

	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}

	fmt.Fprintf(logFile, "\n--- Session started: %s ---\n", time.Now().Format("2006-01-02 15:04:05"))

	handler := &prettyHandler{
		file:   logFile, // pass the file directly
		level:  slog.LevelInfo,
		source: false,
	}

	l := slog.New(handler)
	slog.SetDefault(l)

	return &Logger{
		file:   logFile,
		Logger: l,
	}, nil
}

func (l *Logger) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	slog.Info("Logger service started")
	return nil
}

func (l *Logger) ServiceShutdown() error {
	slog.Info("Logger service shutting down")
	if l.file != nil {
		return l.file.Close()
	}
	return nil
}
