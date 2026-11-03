//! Constructors for the errors checksync reports, one per kind of problem.

mod different_comment_syntax;
mod duplicate_target;
mod end_tag_without_start_tag;
mod file_does_not_exist;
mod malformed_end_tag;
mod malformed_start_tag;
mod start_tag_after_content;
mod start_tag_without_end_tag;

pub use different_comment_syntax::different_comment_syntax;
pub use duplicate_target::duplicate_target;
pub use end_tag_without_start_tag::end_tag_without_start_tag;
pub use file_does_not_exist::file_does_not_exist;
pub use malformed_end_tag::malformed_end_tag;
pub use malformed_start_tag::malformed_start_tag;
pub use start_tag_after_content::start_tag_after_content;
pub use start_tag_without_end_tag::start_tag_without_end_tag;
