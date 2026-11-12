//! Types used by the glob matcher.

/// How a glob pattern treats slashes, letter case and hidden names.
///
/// There's no default: callers choose every option.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[expect(
    clippy::struct_excessive_bools,
    reason = "each option is an independent switch callers set explicitly"
)]
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
    /// Whether wildcards may match a `.` that starts a name.
    ///
    /// When off, as in fast-glob, a name starting with `.` can only be
    /// matched by a pattern name starting with a literal `.` or a bracket set
    /// that isn't negated: `?`, `*`, `**` and negated sets don't match its
    /// `.`, and a `*` can't even match nothing in front of it. Without
    /// `pathname`, this has no effect. git's matching has it on.
    pub dot: bool,
    /// Whether `?` and bracket sets match whole UTF-8 characters.
    ///
    /// When on, as in fast-glob, `?` and a bracket set match one character
    /// of 1 to 4 bytes, bracket sets compare code points, and `*` never stops
    /// inside a character. A byte that isn't part of valid UTF-8, in the
    /// pattern or the text, counts as one character on its own. When off,
    /// as in git, everything matches single bytes.
    pub unicode: bool,
}

/// A glob pattern compiled once so it can be matched against many texts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CompiledGlob {
    /// The pattern's tokens, in order.
    pub(super) tokens: Vec<GlobToken>,
    /// How the pattern treats slashes, letter case and hidden names.
    pub(super) options: GlobOptions,
    /// Whether wildcards stay off a `.` that starts a name.
    ///
    /// Worked out once from `options`: in pathname mode without `dot`.
    pub(super) hides_dots: bool,
}

/// One step of a parsed glob pattern.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum GlobToken {
    /// Exactly one unit of the text: a byte, or a character in unicode mode.
    One(UnitMatcher),
    /// Any run of bytes, including none.
    Star {
        /// Whether the run may include `/`.
        crosses_slash: bool,
    },
    /// Any number of whole folders, including none.
    ///
    /// That's either nothing, or any run of bytes that ends with `/`.
    AnyFolders,
}

/// What one unit of the text has to be to match one glob token.
///
/// A unit is a byte, or a whole character in unicode mode.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum UnitMatcher {
    /// This byte, in either case when folding case.
    Literal(u8),
    /// This byte, written after a `\`.
    ///
    /// When folding case, the text's byte is lowercased and then compared
    /// exactly, so an escaped uppercase letter matches nothing.
    Escaped(u8),
    /// This character of several bytes, escaped or not, in unicode mode.
    Character(Vec<u8>),
    /// Any one unit, written as `?`.
    Any,
    /// A unit from a bracket set, such as `[a-z]`.
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
    /// A single unit, by its code: a byte, or a code point in unicode mode.
    Char(u32),
    /// A range of units, from the first code to the second, as written.
    Range(u32, u32),
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
    /// The expansion would hold more output at once than allowed.
    ///
    /// `take_brace_budget` sets the limits, counting every pattern and byte
    /// held at once, including partial results while groups nest.
    TooManyResults,
}

/// The output a brace expansion holds at once, counted against its limits.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(super) struct BraceBudget {
    /// How many patterns, finished or partial, are held at once.
    pub(super) count: usize,
    /// How many bytes those patterns hold altogether.
    pub(super) bytes: usize,
}

/// What the next piece of a pattern being brace-expanded is.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum BracePiece {
    /// Text kept as written, up to the given index.
    Text(usize),
    /// A brace group.
    Group(BraceGroup),
}

/// A step of brace expansion still in progress, kept on a heap stack.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum BraceFrame {
    /// Expanding a run of the pattern piece by piece.
    Sequence {
        /// The index just past the end of the run.
        end: usize,
        /// Where the next piece starts.
        index: usize,
        /// The expanded patterns so far.
        results: Vec<Vec<u8>>,
    },
    /// Expanding a group's alternatives one after another.
    ///
    /// It holds the state of the run it's in, which carries on once the
    /// group's alternatives are all expanded.
    Group {
        /// Where each alternative lies in the pattern.
        alternatives: Vec<std::ops::Range<usize>>,
        /// Which alternative to expand next.
        next: usize,
        /// The expanded alternatives so far, in order.
        texts: Vec<Vec<u8>>,
        /// The run's expanded patterns before the group.
        results: Vec<Vec<u8>>,
        /// The index just past the end of the run.
        end: usize,
        /// The index just past the group, where the run carries on.
        resume: usize,
    },
}
