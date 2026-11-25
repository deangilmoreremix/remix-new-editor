package idtoken

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const clerkAPIBase = "https://api.clerk.com"

// ClerkVerifier verifies a Clerk session token, so a person already signed in
// to the host app (SmartVideo) is signed in here with no second login.
//
// A Clerk session token is signed with the instance's JWKS and carries the
// user id (sub) but, by default, no email or name and no aud. So the token
// proves who the person is, and the Clerk Backend API (secret key) says what
// their verified email is. The secret key is optional only when the session
// token has been customized to carry email and email_verified.
type ClerkVerifier struct {
	tokens    *Verifier
	secretKey string
	apiBase   string
	client    *http.Client
}

// NewClerkVerifier trusts tokens issued by the Clerk Frontend API at issuer
// (e.g. https://clerk.example.com), minted for one of authorizedParties (the
// origins of the sites that sign people in; empty accepts any).
func NewClerkVerifier(issuer, secretKey string, authorizedParties ...string) *ClerkVerifier {
	issuer = strings.TrimRight(issuer, "/")
	v := NewVerifier(issuer+"/.well-known/jwks.json", []string{issuer}, nil)
	v.noAudience = true
	v.authorizedParties = authorizedParties
	return &ClerkVerifier{
		tokens:    v,
		secretKey: secretKey,
		apiBase:   clerkAPIBase,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

// Verify checks the Clerk session token and returns the identity it asserts.
func (c *ClerkVerifier) Verify(ctx context.Context, raw string) (*Claims, error) {
	claims, err := c.tokens.Verify(ctx, raw)
	if err != nil {
		return nil, err
	}
	if claims.Subject == "" {
		return nil, errors.New("idtoken: clerk token has no subject")
	}
	if claims.Email != "" {
		return claims, nil
	}
	if c.secretKey == "" {
		return nil, errors.New("idtoken: clerk token has no email and CLERK_SECRET_KEY is not set")
	}
	if err := c.fillProfile(ctx, claims); err != nil {
		return nil, err
	}
	return claims, nil
}

// fillProfile reads the person's primary email (and whether Clerk verified it)
// and name from the Clerk Backend API.
func (c *ClerkVerifier) fillProfile(ctx context.Context, claims *Claims) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.apiBase+"/v1/users/"+url.PathEscape(claims.Subject), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.secretKey)
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("idtoken: clerk user lookup returned %d", resp.StatusCode)
	}

	var user struct {
		FirstName      string `json:"first_name"`
		LastName       string `json:"last_name"`
		PrimaryEmailID string `json:"primary_email_address_id"`
		Emails         []struct {
			ID           string `json:"id"`
			Address      string `json:"email_address"`
			Verification struct {
				Status string `json:"status"`
			} `json:"verification"`
		} `json:"email_addresses"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return err
	}
	for _, e := range user.Emails {
		if e.ID == user.PrimaryEmailID {
			claims.Email = e.Address
			claims.EmailVerified = e.Verification.Status == "verified"
			claims.GivenName = user.FirstName
			claims.FamilyName = user.LastName
			return nil
		}
	}
	return errors.New("idtoken: clerk user has no primary email")
}
