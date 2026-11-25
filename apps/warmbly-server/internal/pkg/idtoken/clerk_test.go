package idtoken

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type clerkFixture struct {
	key    *rsa.PrivateKey
	issuer string
	api    *httptest.Server
	v      *ClerkVerifier
}

func newClerkFixture(t *testing.T, secret string, parties ...string) *clerkFixture {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &clerkFixture{key: key}
	idp := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kty": "RSA", "kid": "k1",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	t.Cleanup(idp.Close)
	f.issuer = idp.URL
	f.api = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+secret || r.URL.Path != "/v1/users/user_1" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"first_name":"Ada","last_name":"L","primary_email_address_id":"e2","email_addresses":[` +
			`{"id":"e1","email_address":"old@x.test","verification":{"status":"verified"}},` +
			`{"id":"e2","email_address":"ada@x.test","verification":{"status":"verified"}}]}`))
	}))
	t.Cleanup(f.api.Close)
	f.v = NewClerkVerifier(f.issuer+"/", secret, parties...)
	f.v.apiBase = f.api.URL
	return f
}

func (f *clerkFixture) token(t *testing.T, mod func(jwt.MapClaims)) string {
	t.Helper()
	c := jwt.MapClaims{"iss": f.issuer, "sub": "user_1", "exp": time.Now().Add(time.Minute).Unix(), "azp": "https://app.example.com"}
	if mod != nil {
		mod(c)
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, c)
	tok.Header["kid"] = "k1"
	s, err := tok.SignedString(f.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestClerkVerifierReadsEmailFromTheBackendAPI(t *testing.T) {
	f := newClerkFixture(t, "sk_test", "https://app.example.com")
	c, err := f.v.Verify(context.Background(), f.token(t, nil))
	if err != nil {
		t.Fatal(err)
	}
	if c.Subject != "user_1" || c.Email != "ada@x.test" || !c.EmailVerified || c.GivenName != "Ada" || c.Issuer != f.issuer {
		t.Fatalf("claims = %+v", c)
	}
}

func TestClerkVerifierTakesEmailFromACustomizedToken(t *testing.T) {
	f := newClerkFixture(t, "") // no secret: the token must carry the email
	c, err := f.v.Verify(context.Background(), f.token(t, func(m jwt.MapClaims) { m["email"] = "me@x.test"; m["email_verified"] = true }))
	if err != nil || c.Email != "me@x.test" || !c.EmailVerified {
		t.Fatalf("claims = %+v, err = %v", c, err)
	}
	if _, err := f.v.Verify(context.Background(), f.token(t, nil)); err == nil {
		t.Fatal("a token with no email and no secret key must be refused")
	}
}

func TestClerkVerifierRefusesWhatItShouldNot(t *testing.T) {
	f := newClerkFixture(t, "sk_test", "https://app.example.com")
	for name, mod := range map[string]func(jwt.MapClaims){
		"wrong issuer":    func(m jwt.MapClaims) { m["iss"] = "https://evil.example" },
		"expired":         func(m jwt.MapClaims) { m["exp"] = time.Now().Add(-time.Minute).Unix() },
		"unlisted origin": func(m jwt.MapClaims) { m["azp"] = "https://evil.example" },
		"no subject":      func(m jwt.MapClaims) { delete(m, "sub") },
		"no expiry":       func(m jwt.MapClaims) { delete(m, "exp") },
	} {
		if _, err := f.v.Verify(context.Background(), f.token(t, mod)); err == nil {
			t.Errorf("%s: token accepted", name)
		}
	}
	other, _ := rsa.GenerateKey(rand.Reader, 2048)
	forged := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{"iss": f.issuer, "sub": "user_1", "exp": time.Now().Add(time.Minute).Unix()})
	forged.Header["kid"] = "k1"
	raw, _ := forged.SignedString(other)
	if _, err := f.v.Verify(context.Background(), raw); err == nil {
		t.Error("token signed with another key accepted")
	}
}
