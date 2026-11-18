//! Building the cache from the files a run's options name.

use std::fmt;
use std::path::Path;

use super::MarkerCache;
use crate::file_search::{GetFilesError, get_files};
use crate::options::Options;

/// Why the cache couldn't be built.
#[derive(Debug)]
pub(crate) enum BuildCacheError {
    /// No file matched the include globs.
    NoFiles,
    /// Finding the files failed.
    Files(GetFilesError),
}

impl fmt::Display for BuildCacheError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NoFiles => f.write_str("No matching files"),
            Self::Files(error) => error.fmt(f),
        }
    }
}

impl std::error::Error for BuildCacheError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::NoFiles => None,
            Self::Files(error) => Some(error),
        }
    }
}

impl MarkerCache {
    /// Finds the files the options name and builds the cache from them.
    ///
    /// The include, exclude and ignore-file globs are relative to `cwd`.
    ///
    /// # Errors
    ///
    /// Returns [`BuildCacheError::NoFiles`] when no file matches, and
    /// [`BuildCacheError::Files`] when finding them fails.
    pub(crate) fn build(options: &Options, cwd: &Path) -> Result<Self, BuildCacheError> {
        let files = get_files(
            &options.include_globs,
            &options.exclude_globs,
            &options.ignore_files,
            cwd,
        )
        .map_err(BuildCacheError::Files)?;
        if files.is_empty() {
            return Err(BuildCacheError::NoFiles);
        }
        Ok(Self::from_files(options, &files))
    }
}

#[cfg(test)]
mod tests {
    use std::error::Error;
    use std::fs;
    use std::path::{Path, PathBuf};

    use tempfile::TempDir;

    use super::BuildCacheError;
    use crate::marker_cache::MarkerCache;
    use crate::options::Options;

    fn options() -> Options {
        Options {
            include_globs: vec!["**/*.js".to_owned()],
            exclude_globs: Vec::new(),
            ignore_files: Vec::new(),
            comments: vec!["//".to_owned()],
            allow_empty_tags: false,
            root_marker: None,
            migration: None,
        }
    }

    /// Creates a folder holding a `package.json` and the given empty files.
    fn root(files: &[&str]) -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = fs::canonicalize(dir.path()).unwrap();
        fs::write(path.join("package.json"), "{}").unwrap();
        for name in files {
            fs::write(path.join(name), "").unwrap();
        }
        (dir, path)
    }

    fn keys(cache: &MarkerCache) -> Vec<&Path> {
        cache.iter().map(|(path, _)| path).collect()
    }

    #[test]
    fn builds_the_cache_from_the_include_globs() {
        // Arrange
        let (_dir, root) = root(&["a.js", "b.txt"]);

        // Act
        let cache = MarkerCache::build(&options(), &root).unwrap();

        // Assert
        assert_eq!(keys(&cache), vec![root.join("a.js").as_path()]);
    }

    #[test]
    fn fails_to_build_when_no_file_matches() {
        // Arrange
        let (_dir, root) = root(&["b.txt"]);

        // Act
        let result = MarkerCache::build(&options(), &root);

        // Assert
        assert_eq!(result.unwrap_err().to_string(), "No matching files");
    }

    #[test]
    fn fails_to_build_when_finding_files_fails() {
        // Arrange
        let (_dir, root) = root(&[]);
        let options = Options {
            include_globs: vec!["{a,b}".repeat(20)],
            ..options()
        };

        // Act
        let result = MarkerCache::build(&options, &root);

        // Assert
        assert!(
            result
                .unwrap_err()
                .to_string()
                .starts_with("pattern's braces expand to too many patterns")
        );
    }

    #[test]
    fn gives_the_file_search_error_as_the_source() {
        // Arrange
        let (_dir, root) = root(&[]);
        let options = Options {
            include_globs: vec!["{a,b}".repeat(20)],
            ..options()
        };
        let error = MarkerCache::build(&options, &root).unwrap_err();

        // Act
        let result = error.source().map(ToString::to_string);

        // Assert
        assert_eq!(result, Some(error.to_string()));
    }

    #[test]
    fn gives_no_source_when_no_file_matches() {
        // Arrange
        let error = BuildCacheError::NoFiles;

        // Act
        let result = error.source();

        // Assert
        assert!(result.is_none());
    }
}
