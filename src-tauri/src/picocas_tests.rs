//! Integration tests for PicocasKernel against the real picocas binary.
//! These tests spawn an actual subprocess — they require picocas/picocas to exist
//! at the path returned by picocas::dev_paths().

use crate::picocas::{dev_paths, KernelError, PicocasKernel};

async fn spawn() -> PicocasKernel {
    let (binary, cwd) = dev_paths();
    PicocasKernel::spawn(&binary, &cwd)
        .await
        .expect("picocas failed to spawn — is picocas/picocas built?")
}

#[tokio::test]
async fn basic_arithmetic() {
    let k = spawn().await;
    let r = k.evaluate("2 + 2".into()).await.unwrap();
    assert_eq!(r.output, "4", "2+2 should be 4");
    assert_eq!(r.line_number, 1);
    assert!(!r.is_error);
    assert!(!r.is_null);
    assert!(r.elapsed_ms < 5_000, "should evaluate in <5 s");
}

#[tokio::test]
async fn state_persists_across_calls() {
    let k = spawn().await;
    // Immediate assignment (=) returns the assigned value, not Null.
    // Only delayed assignment (:=) returns Null.
    let assign = k.evaluate("x = 7".into()).await.unwrap();
    assert_eq!(assign.output, "7", "Set[x,7] should echo the value");
    // x^2 in the next call should see x = 7
    let result = k.evaluate("x^2".into()).await.unwrap();
    assert_eq!(result.output, "49");
}

#[tokio::test]
async fn parse_error_surfaces() {
    let k = spawn().await;
    let r = k.evaluate("@@@badexpr".into()).await.unwrap();
    assert!(r.is_error, "bad expression should be an error");
    assert!(
        r.output.contains("Parse error") || r.output.contains("parse error"),
        "error output was: {}",
        r.output
    );
}

#[tokio::test]
async fn assignment_is_null() {
    let k = spawn().await;
    let r = k.evaluate("f[x_] := x^2".into()).await.unwrap();
    assert!(r.is_null, "function definition should return Null");
    assert!(!r.is_error);
}

#[tokio::test]
async fn function_definition_and_call() {
    let k = spawn().await;
    k.evaluate("g[x_] := x^3".into()).await.unwrap();
    let r = k.evaluate("g[3]".into()).await.unwrap();
    assert_eq!(r.output, "27");
}

#[tokio::test]
async fn too_long_rejected_before_sending() {
    let k = spawn().await;
    let big = "x".repeat(11_000);
    let err = k.evaluate(big).await.unwrap_err();
    assert!(
        matches!(err, KernelError::TooLong),
        "expected TooLong, got {:?}",
        err
    );
}

#[tokio::test]
async fn list_output() {
    let k = spawn().await;
    let r = k.evaluate("{1, 2, 3}".into()).await.unwrap();
    assert_eq!(r.output, "{1, 2, 3}");
}

#[tokio::test]
async fn line_numbers_increment() {
    let k = spawn().await;
    let r1 = k.evaluate("1".into()).await.unwrap();
    let r2 = k.evaluate("2".into()).await.unwrap();
    let r3 = k.evaluate("3".into()).await.unwrap();
    assert_eq!(r1.line_number, 1);
    assert_eq!(r2.line_number, 2);
    assert_eq!(r3.line_number, 3);
}
