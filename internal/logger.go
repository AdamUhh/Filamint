package internal

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type Logger struct {
	file *os.File
}

type prettyHandler struct {
	writer io.Writer
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

	timestamp := r.Time.Format("[2006-01-02 15:04:05]")

	var attrs strings.Builder
	r.Attrs(func(a slog.Attr) bool {
		fmt.Fprintf(&attrs, " %s=%v", a.Key, a.Value)
		return true
	})

	_, err := fmt.Fprintf(h.writer, "%s %s %s%s%s\n",
		timestamp,
		level,
		r.Message,
		attrs.String(),
		source,
	)
	return err
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

	// Rotate if logs.txt exceeds 10MB
	if info, err := os.Stat(logPath); err == nil && info.Size() > 10*1024*1024 {
		if err := os.Rename(logPath, oldLogPath); err != nil {
			slog.Warn("Failed to rotate log file", "error", err)
		}
	}

	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %w", err)
	}

	fmt.Fprintf(logFile, "\n--- Session started: %s ---\n", time.Now().Format("2006-01-02 15:04:05"))

	multiWriter := io.MultiWriter(os.Stdout, logFile)

	handler := &prettyHandler{
		writer: multiWriter,
		level:  slog.LevelDebug,
		source: false,
	}

	slog.SetDefault(slog.New(handler))

	return &Logger{file: logFile}, nil
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
