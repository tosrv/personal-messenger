// Package apperr defines domain errors shared by services. Services return
// these (optionally wrapped); the HTTP layer maps them to status codes.
package apperr

import "errors"

var (
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
)
