use fixture_rust::app_module;

#[test]
fn test_app_module() {
    assert_eq!(app_module(), "ok");
}
