package main

import (
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
	"sync"
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

// SpoolFilter represents search and filter criteria
type SpoolFilter struct {
	SearchTerm string   `json:"searchTerm"` // Search across vendor, material, color, notes
	Vendors    []string `json:"vendors"`    // Filter by specific vendors
	Materials  []string `json:"materials"`  // Filter by specific materials
	Colors     []string `json:"colors"`     // Filter by specific colors
	IsTemplate *bool    `json:"isTemplate"` // Filter by template status
	MinWeight  *int     `json:"minWeight"`  // Minimum remaining weight
	MaxWeight  *int     `json:"maxWeight"`  // Maximum remaining weight
	SortBy     string   `json:"sortBy"`     // Field to sort by (default: updated_at)
	SortDesc   bool     `json:"sortDesc"`   // Sort descending (default: true)
}

// PaginationParams represents pagination parameters
type PaginationParams struct {
	Page     int `json:"page"`     // Current page (1-indexed)
	PageSize int `json:"pageSize"` // Items per page
}

// PaginatedSpools represents a paginated response
type PaginatedSpools struct {
	Spools     []Spool `json:"spools"`
	Total      int     `json:"total"`
	Page       int     `json:"page"`
	PageSize   int     `json:"pageSize"`
	TotalPages int     `json:"totalPages"`
}

// SpoolCache manages in-memory caching of spools
type SpoolCache struct {
	mu     sync.RWMutex
	byID   map[int64]*Spool
	byCode map[string]*Spool
	dirty  bool // Indicates if cache needs refresh
}

func NewSpoolCache() *SpoolCache {
	return &SpoolCache{
		byID:   make(map[int64]*Spool),
		byCode: make(map[string]*Spool),
		dirty:  true,
	}
}

// Get retrieves a spool by ID from cache
func (c *SpoolCache) Get(id int64) (*Spool, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	spool, exists := c.byID[id]
	if !exists {
		return nil, false
	}
	// Return a copy to prevent external modifications
	spoolCopy := *spool
	return &spoolCopy, true
}

// GetByCode retrieves a spool by code from cache
func (c *SpoolCache) GetByCode(code string) (*Spool, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	spool, exists := c.byCode[code]
	if !exists {
		return nil, false
	}
	spoolCopy := *spool
	return &spoolCopy, true
}

// Set adds or updates a spool in cache
func (c *SpoolCache) Set(spool *Spool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Create a copy to store in cache
	spoolCopy := *spool
	c.byID[spool.ID] = &spoolCopy
	c.byCode[spool.SpoolCode] = &spoolCopy
}

// Delete removes a spool from cache
func (c *SpoolCache) Delete(id int64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if spool, exists := c.byID[id]; exists {
		delete(c.byCode, spool.SpoolCode)
		delete(c.byID, id)
	}
}

// GetAll returns all cached spools
func (c *SpoolCache) GetAll() []Spool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	spools := make([]Spool, 0, len(c.byID))
	for _, spool := range c.byID {
		spools = append(spools, *spool)
	}
	return spools
}

// LoadAll replaces the entire cache with new data
func (c *SpoolCache) LoadAll(spools []Spool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Clear existing cache
	c.byID = make(map[int64]*Spool, len(spools))
	c.byCode = make(map[string]*Spool, len(spools))

	// Load new data
	for i := range spools {
		spool := &spools[i]
		c.byID[spool.ID] = spool
		c.byCode[spool.SpoolCode] = spool
	}

	c.dirty = false
}

// MarkDirty marks the cache as needing refresh
func (c *SpoolCache) MarkDirty() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.dirty = true
}

// IsDirty checks if cache needs refresh
func (c *SpoolCache) IsDirty() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.dirty
}

type SpoolService struct {
	db    *Database
	cache *SpoolCache
}

func NewSpoolService(db *Database) *SpoolService {
	service := &SpoolService{
		db:    db,
		cache: NewSpoolCache(),
	}

	// Warm up the cache on initialization
	if err := service.warmCache(); err != nil {
		// Log error but don't fail - cache will be lazy-loaded
		fmt.Printf("Warning: failed to warm cache: %v\n", err)
	}

	return service
}

// warmCache loads all spools into cache
func (s *SpoolService) warmCache() error {
	var spools []Spool
	err := s.db.Select(&spools, `SELECT * FROM spools ORDER BY updated_at DESC`)
	if err != nil {
		return err
	}

	s.cache.LoadAll(spools)
	return nil
}

// ensureCacheLoaded checks if cache is dirty and reloads if necessary
func (s *SpoolService) ensureCacheLoaded() error {
	if s.cache.IsDirty() {
		return s.warmCache()
	}
	return nil
}

func convertBoolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func randomSuffix(length int) (string, error) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}

	for i := range b {
		b[i] = chars[b[i]%byte(len(chars))]
	}
	return string(b), nil
}

func (s *SpoolService) generateSpoolCode(material, color string) (string, error) {
	// Ensure we have enough characters
	materialPrefix := strings.ToUpper(material)
	if len(materialPrefix) < 3 {
		materialPrefix = fmt.Sprintf("%-3s", materialPrefix)
	} else {
		materialPrefix = materialPrefix[:3]
	}

	colorPrefix := strings.ToUpper(color)
	if len(colorPrefix) < 2 {
		colorPrefix = fmt.Sprintf("%-2s", colorPrefix)
	} else {
		colorPrefix = colorPrefix[:2]
	}

	base := fmt.Sprintf("%s-%s", materialPrefix, colorPrefix)

	for {
		suffix, err := randomSuffix(4)
		if err != nil {
			return "", err
		}

		code := fmt.Sprintf("%s-%s", base, suffix)

		var exists bool
		err = s.db.Get(&exists,
			`SELECT EXISTS(SELECT 1 FROM spools WHERE spool_code = ?)`,
			code,
		)
		if err != nil {
			return "", err
		}

		if !exists {
			return code, nil
		}
	}
}

func (s *SpoolService) CreateSpool(spool Spool) (int64, error) {
	now := time.Now()

	code, err := s.generateSpoolCode(spool.Material, spool.Color)
	if err != nil {
		return 0, err
	}

	query := `
	INSERT INTO spools (
		spool_code,
		vendor, material, material_type, color, color_hex,
		total_weight, used_weight,
		cost, reference_link, notes, is_template,
		first_used_at, last_used_at,
		created_at, updated_at
	) VALUES (
		?,
		?, ?, ?, ?, ?,
		?, ?,
		?, ?, ?, ?,
		?, ?,
		?, ?
	)
	`

	result, err := s.db.Exec(
		query,
		code,
		spool.Vendor,
		spool.Material,
		spool.MaterialType,
		spool.Color,
		spool.ColorHex,
		spool.TotalWeight,
		spool.UsedWeight,
		spool.Cost,
		spool.ReferenceLink,
		spool.Notes,
		convertBoolToInt(spool.IsTemplate),
		spool.FirstUsedAt,
		spool.LastUsedAt,
		now,
		now,
	)
	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	// Update cache with the newly created spool
	spool.ID = id
	spool.SpoolCode = code
	spool.CreatedAt = now
	spool.UpdatedAt = now
	s.cache.Set(&spool)

	return id, nil
}

func (s *SpoolService) UpdateSpool(spool Spool) error {
	if spool.ID == 0 {
		return errors.New("spool ID is required")
	}

	query := `
	UPDATE spools SET
		vendor = ?,
		material = ?,
		material_type = ?,
		color = ?,
		color_hex = ?,
		total_weight = ?,
		used_weight = ?,
		cost = ?,
		reference_link = ?,
		notes = ?,
		is_template = ?,
		first_used_at = ?,
		last_used_at = ?,
		updated_at = ?
	WHERE id = ?
	`

	now := time.Now()
	_, err := s.db.Exec(
		query,
		spool.Vendor,
		spool.Material,
		spool.MaterialType,
		spool.Color,
		spool.ColorHex,
		spool.TotalWeight,
		spool.UsedWeight,
		spool.Cost,
		spool.ReferenceLink,
		spool.Notes,
		convertBoolToInt(spool.IsTemplate),
		spool.FirstUsedAt,
		spool.LastUsedAt,
		now,
		spool.ID,
	)

	if err != nil {
		return err
	}

	// Update cache
	spool.UpdatedAt = now
	s.cache.Set(&spool)

	return nil
}

func (s *SpoolService) DeleteSpool(id int64) error {
	if id == 0 {
		return errors.New("invalid spool ID")
	}

	_, err := s.db.Exec(`DELETE FROM spools WHERE id = ?`, id)
	if err != nil {
		return err
	}

	// Remove from cache
	s.cache.Delete(id)

	return nil
}

func (s *SpoolService) GetSpoolByCode(code string) (*Spool, error) {
	// Try cache first
	if spool, exists := s.cache.GetByCode(code); exists {
		return spool, nil
	}

	// Cache miss - fetch from DB
	var spool Spool
	err := s.db.Get(&spool, `SELECT * FROM spools WHERE spool_code = ?`, code)
	if err != nil {
		return nil, err
	}

	// Update cache
	s.cache.Set(&spool)

	return &spool, nil
}

func (s *SpoolService) GetSpool(id int64) (*Spool, error) {
	// Try cache first
	if spool, exists := s.cache.Get(id); exists {
		return spool, nil
	}

	// Cache miss - fetch from DB
	var spool Spool
	err := s.db.Get(&spool, `SELECT * FROM spools WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}

	// Update cache
	s.cache.Set(&spool)

	return &spool, nil
}

// ListSpools returns all spools from cache (backwards compatible)
func (s *SpoolService) ListSpools() ([]Spool, error) {
	if err := s.ensureCacheLoaded(); err != nil {
		return nil, err
	}

	spools := s.cache.GetAll()

	// Sort by updated_at DESC (most recent first)
	sortSpoolsByUpdatedAt(spools, true)

	return spools, nil
}

// ListSpoolsPaginated returns paginated and filtered spools
func (s *SpoolService) ListSpoolsPaginated(filter SpoolFilter, pagination PaginationParams) (*PaginatedSpools, error) {
	if err := s.ensureCacheLoaded(); err != nil {
		return nil, err
	}

	// Get all spools from cache
	allSpools := s.cache.GetAll()

	// Apply filters
	filtered := s.applyFilters(allSpools, filter)

	// Apply sorting
	s.applySorting(filtered, filter)

	// Calculate pagination
	if pagination.Page < 1 {
		pagination.Page = 1
	}
	if pagination.PageSize < 1 {
		pagination.PageSize = 20 // Default page size
	}

	total := len(filtered)
	totalPages := (total + pagination.PageSize - 1) / pagination.PageSize

	// Calculate slice bounds
	start := (pagination.Page - 1) * pagination.PageSize
	end := start + pagination.PageSize

	if start >= total {
		// Page is beyond available data
		return &PaginatedSpools{
			Spools:     []Spool{},
			Total:      total,
			Page:       pagination.Page,
			PageSize:   pagination.PageSize,
			TotalPages: totalPages,
		}, nil
	}

	if end > total {
		end = total
	}

	pageSpools := filtered[start:end]

	return &PaginatedSpools{
		Spools:     pageSpools,
		Total:      total,
		Page:       pagination.Page,
		PageSize:   pagination.PageSize,
		TotalPages: totalPages,
	}, nil
}

// applyFilters filters spools based on criteria
func (s *SpoolService) applyFilters(spools []Spool, filter SpoolFilter) []Spool {
	filtered := make([]Spool, 0, len(spools))

	for _, spool := range spools {
		// Search term filter (searches across multiple fields)
		if filter.SearchTerm != "" {
			searchLower := strings.ToLower(filter.SearchTerm)
			matches := strings.Contains(strings.ToLower(spool.Vendor), searchLower) ||
				strings.Contains(strings.ToLower(spool.Material), searchLower) ||
				strings.Contains(strings.ToLower(spool.Color), searchLower) ||
				strings.Contains(strings.ToLower(spool.Notes), searchLower) ||
				strings.Contains(strings.ToLower(spool.SpoolCode), searchLower)

			if !matches {
				continue
			}
		}

		// Vendor filter
		if len(filter.Vendors) > 0 {
			found := false
			for _, vendor := range filter.Vendors {
				if strings.EqualFold(spool.Vendor, vendor) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Material filter
		if len(filter.Materials) > 0 {
			found := false
			for _, material := range filter.Materials {
				if strings.EqualFold(spool.Material, material) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Color filter
		if len(filter.Colors) > 0 {
			found := false
			for _, color := range filter.Colors {
				if strings.EqualFold(spool.Color, color) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Template filter
		if filter.IsTemplate != nil && spool.IsTemplate != *filter.IsTemplate {
			continue
		}

		// Weight filters (remaining weight = total - used)
		remainingWeight := spool.TotalWeight - spool.UsedWeight
		if filter.MinWeight != nil && remainingWeight < *filter.MinWeight {
			continue
		}
		if filter.MaxWeight != nil && remainingWeight > *filter.MaxWeight {
			continue
		}

		filtered = append(filtered, spool)
	}

	return filtered
}

// applySorting sorts spools based on criteria
func (s *SpoolService) applySorting(spools []Spool, filter SpoolFilter) {
	sortBy := filter.SortBy
	if sortBy == "" {
		sortBy = "updated_at"
	}

	switch sortBy {
	case "updated_at":
		sortSpoolsByUpdatedAt(spools, filter.SortDesc)
	case "created_at":
		sortSpoolsByCreatedAt(spools, filter.SortDesc)
	case "vendor":
		sortSpoolsByVendor(spools, filter.SortDesc)
	case "material":
		sortSpoolsByMaterial(spools, filter.SortDesc)
	case "color":
		sortSpoolsByColor(spools, filter.SortDesc)
	case "remaining_weight":
		sortSpoolsByRemainingWeight(spools, filter.SortDesc)
	case "cost":
		sortSpoolsByCost(spools, filter.SortDesc)
	default:
		// Default to updated_at
		sortSpoolsByUpdatedAt(spools, filter.SortDesc)
	}
}

// Sorting helper functions
func sortSpoolsByUpdatedAt(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if spools[i].UpdatedAt.Before(spools[j].UpdatedAt) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if spools[i].UpdatedAt.After(spools[j].UpdatedAt) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

func sortSpoolsByCreatedAt(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if spools[i].CreatedAt.Before(spools[j].CreatedAt) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if spools[i].CreatedAt.After(spools[j].CreatedAt) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

func sortSpoolsByVendor(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if strings.ToLower(spools[i].Vendor) < strings.ToLower(spools[j].Vendor) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if strings.ToLower(spools[i].Vendor) > strings.ToLower(spools[j].Vendor) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

func sortSpoolsByMaterial(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if strings.ToLower(spools[i].Material) < strings.ToLower(spools[j].Material) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if strings.ToLower(spools[i].Material) > strings.ToLower(spools[j].Material) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

func sortSpoolsByColor(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if strings.ToLower(spools[i].Color) < strings.ToLower(spools[j].Color) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if strings.ToLower(spools[i].Color) > strings.ToLower(spools[j].Color) {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

func sortSpoolsByRemainingWeight(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				remainingI := spools[i].TotalWeight - spools[i].UsedWeight
				remainingJ := spools[j].TotalWeight - spools[j].UsedWeight
				if remainingI < remainingJ {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				remainingI := spools[i].TotalWeight - spools[i].UsedWeight
				remainingJ := spools[j].TotalWeight - spools[j].UsedWeight
				if remainingI > remainingJ {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

func sortSpoolsByCost(spools []Spool, desc bool) {
	if desc {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if spools[i].Cost < spools[j].Cost {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	} else {
		for i := 0; i < len(spools)-1; i++ {
			for j := i + 1; j < len(spools); j++ {
				if spools[i].Cost > spools[j].Cost {
					spools[i], spools[j] = spools[j], spools[i]
				}
			}
		}
	}
}

// RefreshCache forces a cache reload from database
func (s *SpoolService) RefreshCache() error {
	return s.warmCache()
}
