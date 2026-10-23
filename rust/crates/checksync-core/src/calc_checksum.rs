/// Calculate the checksum of a sync-tagged block's lines.
///
/// The lines are joined as they are, so each one should keep its own line
/// ending. A leading newline is added first, for backwards compatibility with
/// the sync linter in Khan Academy's codebase. The checksum is the Adler-32
/// of the result's UTF-8 bytes, read as a signed 32-bit integer and written
/// without its sign, matching the original JavaScript implementation.
///
/// # Arguments
///
/// * `lines` - The lines to checksum, each including its line ending if it
///   has one.
///
/// # Returns
///
/// The checksum as a string of decimal digits.
pub fn calc_checksum<S: AsRef<str>>(lines: &[S]) -> String {
    let mut adler = adler2::Adler32::new();
    adler.write_slice(b"\n");
    for line in lines {
        adler.write_slice(line.as_ref().as_bytes());
    }
    adler.checksum().cast_signed().unsigned_abs().to_string()
}

#[cfg(test)]
mod tests {
    use super::calc_checksum;

    #[test]
    fn matches_the_khan_academy_compatibility_vector() {
        // Arrange
        let lines = ["\n", "\n", "a test\n", "more test\n", "\n"];

        // Act
        let result = calc_checksum(&lines);

        // Assert
        assert_eq!(result, "1043727889");
    }

    #[test]
    fn strips_the_sign_from_a_negative_checksum() {
        // Arrange
        let lines = ["Some super important content!"];

        // Act
        let result = calc_checksum(&lines);

        // Assert
        assert_eq!(result, "1472197848");
    }

    #[test]
    fn checksums_the_leading_newline_when_there_are_no_lines() {
        // Arrange
        let lines: [&str; 0] = [];

        // Act
        let result = calc_checksum(&lines);

        // Assert
        assert_eq!(result, "720907");
    }

    #[test]
    fn accepts_owned_strings_as_well_as_string_slices() {
        // Arrange
        let lines = vec![String::from("Some super important content!")];

        // Act
        let result = calc_checksum(&lines);

        // Assert
        assert_eq!(result, "1472197848");
    }
}
