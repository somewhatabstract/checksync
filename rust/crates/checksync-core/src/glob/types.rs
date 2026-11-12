//! Types used by the glob matcher.

/// How a glob pattern treats slashes, letter case and hidden names.
///
/// There's no default: callers choose every option.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct GlobOptions {
    /// Whether `/` separates folders.
    ///
    /// When set, `?`, `*` and bracket sets never match `/`, and a `**` that
    /// makes up a whole folder name matches any number of folders.
    pub pathname: bool,
    /// Whether ASCII letters match regardless of case.
    ///
    /// After a `\` or inside a bracket set, the text's byte is lowercased
    /// and compared with the pattern as written, so `\A` and `[A]` match
    /// nothing, though ranges and classes such as `[A-Z]` and `[:upper:]`
    /// still match lowercase letters.
    pub casefold: bool,
    /// Whether wildcards may match a `.` that starts a name, in pathname
    /// mode.
    ///
    /// When off, as in fast-glob, a name starting with `.` can only be
    /// matched by a pattern name starting with a literal `.` or a bracket set
    /// that isn't negated: `?`, `*`, `**` and negated sets don't match its
    /// `.`, and a `*` can't even match nothing in front of it. Without
    /// `pathname`, this has no effect. git's matching has it on.
    pub dot: bool,
}

/// A glob pattern compiled once so it can be matched against many texts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CompiledGlob {
    /// The pattern's tokens, in order.
    pub(super) tokens: Vec<GlobToken>,
    /// How the pattern treats slashes, letter case and hidden names.
    pub(super) options: GlobOptions,
    /// Whether wildcards stay off a `.` that starts a name, worked out once
    /// from `options`: in pathname mode without `dot`.
    pub(super) hides_dots: bool,
}

/// One step of a parsed glob pattern.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum GlobToken {
    /// Exactly one byte of the text.
    One(ByteMatcher),
    /// Any run of bytes, including none.
    Star {
        /// Whether the run may include `/`.
        crosses_slash: bool,
    },
    /// Any number of whole folders, including none: either nothing, or any
    /// run of bytes that ends with `/`.
    AnyFolders,
}

/// What a single byte of the text has to be to match one glob token.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ByteMatcher {
    /// This byte, in either case when folding case.
    Literal(u8),
    /// This byte, written after a `\`.
    ///
    /// When folding case, the text's byte is lowercased and then compared
    /// exactly, so an escaped uppercase letter matches nothing.
    Escaped(u8),
    /// Any byte, written as `?`.
    Any,
    /// A byte from a bracket set, such as `[a-z]`.
    Set(BracketSet),
}

/// A parsed bracket expression, such as `[!a-z]`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct BracketSet {
    /// Whether the set was negated with a leading `!` or `^`.
    pub(super) negated: bool,
    /// The members of the set, in the order they were written.
    pub(super) items: Vec<BracketItem>,
}

/// One member of a bracket set.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum BracketItem {
    /// A single byte.
    Byte(u8),
    /// A range of bytes, from the first to the second, as written.
    Range(u8, u8),
    /// A POSIX character class, such as `[:alpha:]`.
    Class(PosixClass),
}

/// A POSIX character class that a bracket set can name.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum PosixClass {
    /// Letters and digits.
    Alnum,
    /// Letters.
    Alpha,
    /// Space and tab.
    Blank,
    /// Control bytes.
    Cntrl,
    /// Decimal digits.
    Digit,
    /// Visible bytes, excluding space.
    Graph,
    /// Lowercase letters.
    Lower,
    /// Visible bytes and space.
    Print,
    /// Visible bytes that are neither letters nor digits.
    Punct,
    /// Space, tab, line feed and carriage return.
    Space,
    /// Uppercase letters.
    Upper,
    /// Hexadecimal digits.
    Xdigit,
}

/// What a `[:` inside a bracket set turned out to start.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ClassSyntax {
    /// Not a class: the `[` is an ordinary member of the set.
    NotAClass,
    /// A known class, and the index just past its closing `:]`.
    Known(PosixClass, usize),
    /// A class with a name that isn't recognized.
    Unknown,
}

/// A `{...}` group of comma-separated alternatives found in a pattern.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct BraceGroup {
    /// Where each alternative lies in the pattern, in order.
    pub(super) alternatives: Vec<std::ops::Range<usize>>,
    /// The index just past the group's closing `}`.
    pub(super) end: usize,
}

/// Why a pattern's brace groups couldn't be expanded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BraceExpansionError {
    /// The pattern is longer than `expand_braces` accepts.
    PatternTooLong,
    /// The pattern's braces nest deeper than `expand_braces` accepts.
    NestedTooDeeply,
    /// The expansion would give more patterns, or more bytes of them, than
    /// `expand_braces` allows.
    TooManyResults,
}
