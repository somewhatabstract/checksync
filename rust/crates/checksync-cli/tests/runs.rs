//! Check that the `checksync` binary builds and runs.

use std::process::Command;

#[test]
fn exits_successfully() {
    // Arrange
    let mut checksync = Command::new(env!("CARGO_BIN_EXE_checksync"));

    // Act
    let status = checksync.status().expect("checksync should start");

    // Assert
    assert!(status.success());
}
