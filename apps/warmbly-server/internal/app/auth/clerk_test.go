package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/warmbly/warmbly/internal/errx"
	"github.com/warmbly/warmbly/internal/pkg/idtoken"
)

type refusingVerifier struct{}

func (refusingVerifier) Verify(context.Context, string) (*idtoken.Claims, error) {
	return nil, errors.New("bad token")
}

func TestClerkTokenAuthIsOffUntilConfigured(t *testing.T) {
	s := &authService{}
	if _, err := s.ClerkTokenAuth(context.Background(), "jwt", "1.2.3.4", "ua"); err != errx.ErrExternalProvider {
		t.Fatalf("with no Clerk verifier, err = %v, want ErrExternalProvider", err)
	}
}

func TestClerkTokenAuthRefusesATokenClerkDidNotSign(t *testing.T) {
	s := &authService{}
	s.WireClerk(refusingVerifier{})
	if _, err := s.ClerkTokenAuth(context.Background(), "jwt", "1.2.3.4", "ua"); err != errx.ErrExternalCode {
		t.Fatalf("err = %v, want ErrExternalCode", err)
	}
}

func TestClerkTokenAuthNeedsAVerifiedEmail(t *testing.T) {
	s := &authService{}
	s.WireClerk(tokenVerifierStub{claims: &idtoken.Claims{Subject: "user_1", Issuer: "https://clerk.example", Email: "a@x.test", EmailVerified: false}})
	if _, err := s.ClerkTokenAuth(context.Background(), "valid", "1.2.3.4", "ua"); err != errx.ErrExternalEmail {
		t.Fatalf("err = %v, want ErrExternalEmail", err)
	}
}
