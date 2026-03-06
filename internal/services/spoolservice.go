package services

import (
	internal "changeme/internal"
	"fmt"
	"log/slog"
	"strings"
	"time"
)

type Spool struct {
	ID        int64  `db:"id" json:"id"`
	SpoolCode string `db:"spool_code" json:"spoolCode"`

	Vendor       string `db:"vendor" json:"vendor"`
	Material     string `db:"material" json:"material"`
	MaterialType string `db:"material_type" json:"materialType"`
	Color        string `db:"color" json:"color"`
	ColorHex     string `db:"color_hex" json:"colorHex"`

	TotalWeight   int    `db:"total_weight" json:"totalWeight"`
	UsedWeight    int    `db:"used_weight" json:"usedWeight"`
	Cost          int    `db:"cost" json:"cost"`
	ReferenceLink string `db:"reference_link" json:"referenceLink"`
	Notes         string `db:"notes" json:"notes"`
	IsTemplate    bool   `db:"is_template" json:"isTemplate"`

	FirstUsedAt *time.Time `db:"first_used_at" json:"firstUsedAt"`
	LastUsedAt  *time.Time `db:"last_used_at" json:"lastUsedAt"`

	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

type SpoolQueryParams struct {
	Search     string `json:"search"`
	IsTemplate *bool  `json:"isTemplate"`
	SortBy     string `json:"sortBy"`
	SortOrder  string `json:"sortOrder"`
	Limit      int    `json:"limit"`
	Offset     int    `json:"offset"`
}

type SpoolQueryResult struct {
	Spools []Spool `json:"spools"`
	Total  int     `json:"total"`
}

type SpoolPrint struct {
	PrintID   int64  `db:"print_id" json:"printId"`
	PrintName string `db:"print_name" json:"printName"`
	GramsUsed int    `db:"grams_used" json:"gramsUsed"`
}

type SpoolService struct {
	repo *SpoolRepository
}

func NewSpoolService(database *Database) *SpoolService {
	return &SpoolService{
		repo: NewSpoolRepository(database.db),
	}
}

func (s *SpoolService) CreateSpool(spool Spool) (int64, error) {
	if err := validateSpool(spool); err != nil {
		slog.Error("spool validation failed", "error", err)
		return 0, err
	}

	now := time.Now()
	spool.CreatedAt = now
	spool.UpdatedAt = now

	const maxAttempts = 5
	for i := range maxAttempts {
		code, err := internal.GenerateSpoolCodeBase(spool.Material, spool.Color)
		if err != nil {
			slog.Error("failed to generate spool code", "error", err, "attempt", i+1)
			return 0, fmt.Errorf("generating spool code: %w", err)
		}

		id, err := s.repo.Insert(spool, code)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				continue
			}
			slog.Error("failed to insert spool", "error", err, "attempt", i+1)
			return 0, err
		}

		slog.Info("spool created", "id", id, "code", code)
		return id, nil
	}

	slog.Error("failed to generate unique spool code", "maxAttempts", maxAttempts)
	return 0, fmt.Errorf("failed to generate unique spool code after %d retries", maxAttempts)
}

func (s *SpoolService) UpdateSpool(spool Spool) error {
	if spool.ID == 0 {
		err := fmt.Errorf("spool id is required")
		slog.Error(err.Error())
		return err
	}
	if err := validateSpool(spool); err != nil {
		slog.Error("spool validation failed", "id", spool.ID, "error", err)
		return err
	}

	spool.UpdatedAt = time.Now()

	if err := s.repo.Update(spool); err != nil {
		slog.Error("failed to update spool", "id", spool.ID, "error", err)
		return err
	}

	slog.Info("spool updated", "id", spool.ID)
	return nil
}

func (s *SpoolService) DeleteSpool(id int64) error {
	if id == 0 {
		err := fmt.Errorf("invalid spool id")
		slog.Error(err.Error())
		return err
	}

	if err := s.repo.Delete(id); err != nil {
		slog.Error("failed to delete spool", "id", id, "error", err)
		return err
	}

	slog.Info("spool deleted", "id", id)
	return nil
}

func (s *SpoolService) GetSpoolPrints(spoolID int64) ([]SpoolPrint, error) {
	prints, err := s.repo.GetPrints(spoolID)
	if err != nil {
		slog.Error("failed to get prints for spool", "spoolID", spoolID, "error", err)
		return nil, err
	}
	return prints, nil
}

func (s *SpoolService) QuerySpools(params SpoolQueryParams) (*SpoolQueryResult, error) {
	if params.SortBy == "" {
		params.SortBy = "updated_at"
	}
	if params.SortOrder == "" {
		params.SortOrder = "DESC"
	}
	if params.Limit <= 0 {
		params.Limit = 15
	}

	result, err := s.repo.Query(params)
	if err != nil {
		slog.Error("failed to query spools", "error", err)
		return nil, err
	}
	return result, nil
}

func (s *SpoolService) ServiceShutdown() error {
	slog.Info("Spool service shutting down")
	return nil
}

func validateSpool(spool Spool) error {
	if strings.TrimSpace(spool.Material) == "" {
		return fmt.Errorf("material is required")
	}
	if strings.TrimSpace(spool.Color) == "" {
		return fmt.Errorf("color is required")
	}
	if spool.TotalWeight <= 0 {
		return fmt.Errorf("total_weight must be > 0")
	}
	if spool.UsedWeight < 0 {
		return fmt.Errorf("used_weight cannot be negative")
	}
	if spool.UsedWeight > spool.TotalWeight {
		return fmt.Errorf("used_weight cannot exceed total_weight")
	}
	if spool.Cost < 0 {
		return fmt.Errorf("cost cannot be negative")
	}
	return nil
}
