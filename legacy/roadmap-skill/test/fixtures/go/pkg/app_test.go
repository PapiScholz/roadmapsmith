package pkg

import "testing"

func TestAppModule(t *testing.T) {
    if AppModule() != "ok" {
        t.Fatal("unexpected value")
    }
}
